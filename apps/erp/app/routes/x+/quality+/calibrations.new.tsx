import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { useUrlParams } from "@carbon/remix";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useLoaderData, useNavigate } from "@remix-run/react";
import type { FileObject } from "@supabase/storage-js";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { nanoid } from "nanoid";
import { useEffect, useMemo } from "react";
import {
  gaugeCalibrationRecordValidator,
  getQualityFiles,
  upsertGaugeCalibrationRecord,
} from "~/modules/quality";
import GaugeCalibrationRecordForm from "~/modules/quality/ui/Calibrations/GaugeCalibrationRecordForm";

import { setCustomFields } from "~/utils/form";
import { getParams, path } from "~/utils/path";

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    create: "quality",
  });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    return json({
      files: await getQualityFiles(client, id, companyId),
    });
  }

  return json({
    files: [] as FileObject[],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "quality",
  });

  const formData = await request.formData();
  const validation = await validator(gaugeCalibrationRecordValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const data = validation.data;

  const inspectionStatus =
    data.requiresAction || data.requiresAdjustment || data.requiresRepair
      ? "Fail"
      : "Pass";

  console.log({ data });

  const createGauge = await upsertGaugeCalibrationRecord(client, {
    ...data,
    inspectionStatus,
    companyId,
    createdBy: userId,
    customFields: setCustomFields(formData),
  });

  if (createGauge.error || !createGauge.data) {
    throw redirect(
      path.to.gauges,
      await flash(
        request,
        error(createGauge.error, "Failed to insert gauge calibration record")
      )
    );
  }

  throw redirect(
    `${path.to.calibrations}?${getParams(request)}`,
    await flash(request, success("Calibration record created"))
  );
}

export default function GaugeCalibrationRecordNewRoute() {
  const navigate = useNavigate();
  const { files } = useLoaderData<typeof loader>();
  const id = useMemo(() => nanoid(), []);
  const [params, setParams] = useUrlParams();

  useEffect(() => {
    if (params.get("id") !== id) {
      setParams({
        id,
      });
    }
  }, [id, params, setParams]);

  const initialValues = {
    id,
    gaugeId: "",
    dateCalibrated: today(getLocalTimeZone()).toString(),
    requiresAction: false,
    requiresAdjustment: false,
    requiresRepair: false,
    temperature: undefined,
    humidity: undefined,
    approvedBy: undefined,
    notes: "{}",
  };

  return (
    <GaugeCalibrationRecordForm
      initialValues={initialValues}
      files={files}
      onClose={() => navigate(path.to.calibrations)}
    />
  );
}
