import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import {
  deleteStockTransfer,
  stockTransferValidator,
  upsertStockTransfer,
  upsertStockTransferLines,
} from "~/modules/inventory";
import { getNextSequence } from "~/modules/settings";
import { setCustomFields } from "~/utils/form";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

export const handle: Handle = {
  breadcrumb: "Stock Transfers",
  to: path.to.stockTransfers,
};

export async function action({ request }: ActionFunctionArgs) {
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "inventory",
  });

  const formData = await request.formData();
  const validation = await validator(stockTransferValidator).validate(formData);

  if (validation.error) {
    return validationError(validation.error);
  }

  const nextSequence = await getNextSequence(
    client,
    "stockTransfer",
    companyId
  );
  if (nextSequence.error) {
    throw redirect(
      path.to.stockTransfers,
      await flash(
        request,
        error(nextSequence.error, "Failed to get next sequence")
      )
    );
  }

  const { locationId, lines } = validation.data;

  const createStockTransfer = await upsertStockTransfer(client, {
    stockTransferId: nextSequence.data,
    locationId,
    companyId,
    createdBy: userId,
    customFields: setCustomFields(formData),
  });

  if (createStockTransfer.error) {
    throw redirect(
      path.to.stockTransfers,
      await flash(
        request,
        error(createStockTransfer.error, "Failed to create stock transfer")
      )
    );
  }

  const createStockTransferLines = await upsertStockTransferLines(client, {
    lines,
    stockTransferId: createStockTransfer.data.id,
    companyId,
    createdBy: userId,
  });

  if (createStockTransferLines.error) {
    await deleteStockTransfer(client, createStockTransfer.data.id);
    throw redirect(
      path.to.stockTransfers,
      await flash(
        request,
        error(
          createStockTransferLines.error,
          "Failed to create stock transfer lines"
        )
      )
    );
  }

  throw redirect(path.to.stockTransfer(createStockTransfer.data.id));
}
