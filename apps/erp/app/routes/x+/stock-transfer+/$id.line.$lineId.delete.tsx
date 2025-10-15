import { error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { deleteStockTransferLine } from "~/modules/inventory";
import { path } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  const { client } = await requirePermissions(request, {
    delete: "inventory",
  });

  const { id, lineId } = params;

  if (!id) throw new Error("id is not found");
  if (!lineId) throw new Error("lineId is not found");

  const mutation = await deleteStockTransferLine(client, lineId);
  if (mutation.error) {
    return json(
      {
        success: false,
      },
      await flash(request, error(mutation.error, "Failed to delete line"))
    );
  }

  throw redirect(
    path.to.stockTransfer(id),
    await flash(request, success("Successfully deleted line"))
  );
}
