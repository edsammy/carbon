import { error, notFound, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import { path } from "~/utils/path";

export async function loader({ request, params }: ActionFunctionArgs) {
  const { client } = await requirePermissions(request, {
    update: "inventory",
  });

  const url = new URL(request.url);

  const { id, lineId } = params;
  if (!id) throw notFound("id not found");
  if (!lineId) throw notFound("lineId not found");

  const updateQuantityUrl = new URL(
    `${url.origin}${path.to.stockTransferLineQuantity(lineId)}`
  );

  const [stockTransferLine, stockTransfer] = await Promise.all([
    client.from("stockTransferLine").select("*").eq("id", lineId).single(),
    client.from("stockTransfer").select("*").eq("id", id).single(),
  ]);

  if (stockTransferLine.error || stockTransfer.error) {
    throw redirect(
      path.to.stockTransfer(id),
      await flash(
        request,
        error(
          stockTransferLine.error || stockTransfer.error,
          "Failed to load stock transfer line or stock transfer"
        )
      )
    );
  }

  if (!["In Progress", "Released"].includes(stockTransfer.data?.status ?? "")) {
    throw redirect(
      path.to.stockTransfer(id),
      await flash(
        request,
        error(
          "Stock transfer is not in progress or released",
          "Stock transfer is not in progress or released"
        )
      )
    );
  }

  if (stockTransferLine.data?.pickedQuantity > 0) {
    throw redirect(
      path.to.stockTransfer(id),
      await flash(request, error("Line already picked", "Line already picked"))
    );
  }

  const formData = new FormData();
  formData.append("id", lineId);
  formData.append("quantity", "0");
  formData.append("locationId", stockTransfer.data?.locationId ?? "");
  if (
    stockTransferLine.data?.requiresSerialTracking ||
    stockTransferLine.data?.requiresBatchTracking
  ) {
    formData.append(
      "trackedEntityId",
      stockTransferLine.data?.trackedEntityId ?? ""
    );
  }

  const result = await fetch(updateQuantityUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: request.headers.get("Authorization") || "",
      Cookie: request.headers.get("Cookie") || "",
    },
    body: formData,
  });

  const { data } = await result.json();

  if (data?.success) {
    throw redirect(
      path.to.stockTransfer(id),
      await flash(request, success(data?.message))
    );
  }

  throw redirect(
    path.to.stockTransfer(id),
    await flash(
      request,
      error(data?.message, data?.message ?? "Failed to unpick line")
    )
  );
}
