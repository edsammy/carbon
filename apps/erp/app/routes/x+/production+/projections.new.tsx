import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { useRouteData } from "@carbon/remix";
import { getLocalTimeZone, startOfWeek, today } from "@internationalized/date";
import { useNavigate } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { demandProjectionValidator } from "~/modules/production/production.models";
import { upsertDemandProjections } from "~/modules/production/production.service";
import DemandProjectionForm from "~/modules/production/ui/Projection/DemandProjectionForm";
import { getPeriods } from "~/modules/shared/shared.service";
import { path } from "~/utils/path";

const WEEKS_TO_PROJECT = 52;

export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = await requirePermissions(request, {
    create: "production",
  });

  const startDate = startOfWeek(today(getLocalTimeZone()), "en-US");
  const endDate = startDate.add({ weeks: WEEKS_TO_PROJECT });
  const periods = await getPeriods(client, {
    startDate: startDate.toString(),
    endDate: endDate.toString(),
  });

  if (periods.error) {
    throw new Error("Failed to load periods");
  }

  return json({ periods: periods.data ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "production",
  });

  const formData = await request.formData();
  const validation = await validator(demandProjectionValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { itemId, locationId, periods, ...weekData } = validation.data;

  // Extract week values and create demand forecast records
  const demandProjections = [];

  for (let i = 0; i < 52; i++) {
    const weekKey = `week${i}` as keyof typeof weekData;
    const quantity = weekData[weekKey];

    if (
      quantity !== undefined &&
      quantity !== null &&
      quantity > 0 &&
      periods?.[i]
    ) {
      demandProjections.push({
        itemId,
        locationId,
        periodId: periods[i],
        forecastQuantity: quantity,
        companyId,
        createdBy: userId,
      });
    }
  }

  if (demandProjections.length === 0) {
    return json(
      {},
      await flash(request, error(null, "No forecast quantities provided"))
    );
  }

  const result = await upsertDemandProjections(client, demandProjections);

  if (result.error) {
    return json(
      {},
      await flash(
        request,
        error(result.error, "Failed to save demand forecasts")
      )
    );
  }

  return redirect(
    path.to.demandProjections + `?location=${locationId}`,
    await flash(request, success("Demand forecasts created successfully"))
  );
}

export default function NewProjectionRoute() {
  const navigate = useNavigate();
  const routeData = useRouteData<{
    locationId: string;
  }>(path.to.demandProjections);

  const initialValues = {
    itemId: "",
    locationId: routeData?.locationId ?? "",
    ...Object.fromEntries(
      Array.from({ length: 52 }, (_, i) => [`week${i}`, 0])
    ),
  };

  return (
    <DemandProjectionForm
      onClose={() => navigate(-1)}
      initialValues={initialValues}
    />
  );
}
