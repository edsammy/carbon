import {
  assertIsPost,
  error,
  getCarbonServiceRole,
  success,
} from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { FunctionRegion } from "@supabase/supabase-js";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import {
  jobStatus,
  recalculateJobRequirements,
  runMRP,
  updateJobStatus,
} from "~/modules/production";
import { path, requestReferrer } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "production",
  });

  const { jobId: id } = params;
  if (!id) throw new Error("Could not find id");

  const url = new URL(request.url);
  const shouldSchedule = url.searchParams.get("schedule") === "1";

  const formData = await request.formData();
  const status = formData.get("status") as (typeof jobStatus)[number];
  const selectedPurchaseOrdersBySupplierId = formData.get(
    "selectedPurchaseOrdersBySupplierId"
  ) as string | null;

  if (!status || !jobStatus.includes(status)) {
    throw redirect(
      path.to.job(id),
      await flash(request, error(null, "Invalid status"))
    );
  }

  if (status === "Ready") {
    const { data } = await client
      .from("job")
      .select("item(itemReplenishment(manufacturingBlocked))")
      .eq("id", id)
      .single();

    if (data?.item?.itemReplenishment?.manufacturingBlocked) {
      throw redirect(
        requestReferrer(request) ?? path.to.job(id),
        await flash(request, error(null, "Manufacturing is blocked"))
      );
    }
  }

  if (["Planned", "Ready"].includes(status)) {
    const serviceRole = getCarbonServiceRole();
    await recalculateJobRequirements(serviceRole, {
      id,
      companyId,
      userId,
    });
    await runMRP(getCarbonServiceRole(), {
      type: "job",
      id,
      companyId,
      userId,
    });
  }

  if (["Ready", "Planned"].includes(status) && shouldSchedule) {
    try {
      const purchaseOrdersBySupplierId = JSON.parse(
        selectedPurchaseOrdersBySupplierId ?? "{}"
      );

      const serviceRole = getCarbonServiceRole();
      const [scheduler] = await Promise.all([
        serviceRole.functions.invoke("scheduler", {
          body: {
            type: "schedule",
            jobId: id,
            companyId,
            userId,
          },
          region: FunctionRegion.UsEast1,
        }),
        serviceRole.functions.invoke("create", {
          body: {
            type: "purchaseOrderFromJob",
            jobId: id,
            purchaseOrdersBySupplierId,
            companyId,
            userId,
          },
          region: FunctionRegion.UsEast1,
        }),
      ]);

      if (scheduler.error) {
        throw redirect(
          requestReferrer(request) ?? path.to.job(id),
          await flash(request, error(error, "Failed to schedule job"))
        );
      }

      if (status === "Ready") {
        await client
          .from("job")
          .update({
            releasedDate: new Date().toISOString(),
          })
          .eq("id", id);
      }
    } catch (err) {
      console.error(err);
      throw redirect(
        requestReferrer(request) ?? path.to.job(id),
        await flash(request, error(err, "Failed to schedule job"))
      );
    }
  }

  const update = await updateJobStatus(client, {
    id,
    status,
    assignee: ["Cancelled"].includes(status) ? null : undefined,
    updatedBy: userId,
  });
  if (update.error) {
    throw redirect(
      requestReferrer(request) ?? path.to.job(id),
      await flash(request, error(update.error, "Failed to update job status"))
    );
  }

  if (status === "Planned") {
    throw redirect(
      path.to.jobMaterials(id),
      await flash(request, success("Job marked as planned"))
    );
  }

  throw redirect(
    requestReferrer(request) ?? path.to.job(id),
    await flash(request, success("Updated job status"))
  );
}
