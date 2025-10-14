import { error, getCarbonServiceRole } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import { stockTransferValidator } from "~/modules/inventory";
import { getNextSequence } from "~/modules/settings";
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

  const serviceRole = await getCarbonServiceRole();

  const formData = await request.formData();
  const validation = await validator(stockTransferValidator).validate(formData);

  if (validation.error) {
    return validationError(validation.error);
  }

  const nextSequence = await getNextSequence(
    serviceRole,
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

  console.log(validation.data);

  // const createIssue = await upsertIssue(serviceRole, {
  //   ...nonConformance,
  //   nonConformanceId: nextSequence.data,
  //   companyId,
  //   createdBy: userId,
  //   customFields: setCustomFields(formData),
  // });

  // if (createIssue.error || !createIssue.data) {
  //   throw redirect(
  //     path.to.issues,
  //     await flash(request, error(createIssue.error, "Failed to insert issue"))
  //   );
  // }

  // const ncrId = createIssue.data?.id;
  // if (!ncrId) {
  //   throw redirect(
  //     path.to.issues,
  //     await flash(request, error("Failed to insert issue"))
  //   );
  // }
}
