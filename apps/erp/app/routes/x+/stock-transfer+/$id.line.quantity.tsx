import {
  assertIsPost,
  error,
  getCarbonServiceRole,
  notFound,
  success,
} from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { Database } from "@carbon/database";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "inventory",
  });

  const { id } = params;
  if (!id) throw notFound("id not found");

  const formData = await request.formData();

  const lineId = formData.get("id") as string;
  const pickedQuantity = parseInt(formData.get("quantity") as string, 10);
  const locationId = formData.get("locationId") as string;

  if (!lineId || !Number.isFinite(pickedQuantity)) {
    return json(
      {
        success: false,
      },
      await flash(request, error("Invalid form data", "Invalid form data"))
    );
  }

  const stockTransferLine = await client
    .from("stockTransferLine")
    .select("*")
    .eq("id", lineId)
    .single();

  if (!stockTransferLine.data) {
    return json(
      {
        success: false,
      },
      await flash(
        request,
        error("Stock transfer line not found", "Stock transfer line not found")
      )
    );
  }

  const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
    [];

  const today = new Date().toISOString().split("T")[0];
  const transactionQuantity =
    pickedQuantity === 0
      ? -stockTransferLine.data.pickedQuantity
      : pickedQuantity;

  itemLedgerInserts.push({
    postingDate: today,
    itemId: stockTransferLine.data.itemId,
    quantity: transactionQuantity,
    locationId: locationId,
    shelfId: stockTransferLine.data.toShelfId,
    entryType: "Transfer",
    documentType: "Direct Transfer",
    documentId: stockTransferLine.data.stockTransferId ?? undefined,
    createdBy: userId,
    companyId,
  });

  itemLedgerInserts.push({
    postingDate: today,
    itemId: stockTransferLine.data.itemId,
    quantity: -transactionQuantity,
    locationId: locationId,
    shelfId: stockTransferLine.data.fromShelfId,
    entryType: "Transfer",
    documentType: "Direct Transfer",
    documentId: stockTransferLine.data.stockTransferId ?? undefined,
    createdBy: userId,
    companyId,
  });

  const serviceRole = getCarbonServiceRole();

  const insertItemTransactions = await serviceRole
    .from("itemLedger")
    .insert(itemLedgerInserts)
    .select("id");

  if (insertItemTransactions.error) {
    return json(
      {
        success: false,
      },
      await flash(
        request,
        error(insertItemTransactions.error, "Failed to insert item ledger")
      )
    );
  }

  const quantityUpdate = await client
    .from("stockTransferLine")
    .update({
      pickedQuantity,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lineId)
    .eq("companyId", companyId);

  if (quantityUpdate.error) {
    await serviceRole
      .from("itemLedger")
      .delete()
      .in("id", insertItemTransactions.data?.map((item) => item.id) ?? []);

    return json(
      {
        success: false,
      },
      await flash(request, error(quantityUpdate.error, "Failed to update line"))
    );
  }

  return json(
    {
      success: true,
    },
    await flash(
      request,
      success(
        `${pickedQuantity} ${
          pickedQuantity === 1 ? "item" : "items"
        } marked as picked`
      )
    )
  );
}
