import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import { convertSalesOrderLinesToJobs } from "~/modules/production/production.service";
import { path, requestReferrer } from "~/utils/path";

export const config = { runtime: "nodejs", timeout: 10000 };

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client } = await requirePermissions(request, {
    create: "production",
  });

  const { orderId } = params;
  if (!orderId) {
    throw new Error("Invalid orderId");
  }

  const { companyId, userId } = await requirePermissions(request, {
    create: "production",
  });

  const salesOrder = await convertSalesOrderLinesToJobs(client, {
    orderId,
    companyId,
    userId,
  });

  if (salesOrder.error) {
    throw redirect(
      path.to.salesOrder(orderId),
      await flash(
        request,
        error(salesOrder.error, "Failed to convert sales order lines to jobs")
      )
    );
  }

  throw redirect(
    requestReferrer(request) ?? path.to.salesOrder(orderId),
    await flash(request, success("Jobs created"))
  );
}
