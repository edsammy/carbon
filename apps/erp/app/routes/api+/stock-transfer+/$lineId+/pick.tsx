import { assertIsPost, notFound, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "inventory",
  });

  const { lineId } = params;
  if (!lineId) throw notFound("lineId not found");

  // TODO: Implement pick functionality
  // This would typically:
  // 1. Get the stock transfer line
  // 2. Update the pickedQuantity
  // 3. Create inventory transactions
  // 4. Update stock transfer status if needed

  return json(
    {
      success: true,
      message: "Pick functionality not yet implemented",
    },
    await flash(request, success("Pick operation completed"))
  );
}
