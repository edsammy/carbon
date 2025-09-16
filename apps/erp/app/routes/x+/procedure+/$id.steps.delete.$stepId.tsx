import { error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { deleteProcedureStep } from "~/modules/production/production.service";

export async function action({ request, params }: ActionFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    delete: "production",
  });

  const { stepId } = params;

  if (!stepId) throw new Error("stepId is not found");

  const deleteStep = await deleteProcedureStep(client, stepId, companyId);
  if (deleteStep.error) {
    return json(
      {
        success: false,
      },
      await flash(request, error(deleteStep.error, "Failed to delete step"))
    );
  }

  return json(
    {
      success: true,
    },
    await flash(request, success("Successfully deleted step"))
  );
}
