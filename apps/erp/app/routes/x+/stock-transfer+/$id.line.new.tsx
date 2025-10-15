import { assertIsPost, error, notFound, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { useRouteData } from "@carbon/remix";
import { useNavigate, useParams } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import {
  stockTransferLineValidator,
  upsertStockTransferLine,
} from "~/modules/inventory";
import type { StockTransfer } from "~/modules/inventory/types";
import StockTransferLineForm from "~/modules/inventory/ui/StockTransfers/StockTransferLineForm";

import { path } from "~/utils/path";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePermissions(request, {
    create: "inventory",
  });

  return null;
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "inventory",
  });

  const { id } = params;
  if (!id) throw notFound("id not found");

  const formData = await request.formData();

  const validation = await validator(stockTransferLineValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { id: lineId, ...data } = validation.data;

  const insertStockTransferLine = await upsertStockTransferLine(client, {
    ...data,
    companyId,
    createdBy: userId,
  });
  if (insertStockTransferLine.error) {
    return json(
      {},
      await flash(
        request,
        error(insertStockTransferLine.error, "Failed to insert line")
      )
    );
  }

  return redirect(
    path.to.stockTransfer(id),
    await flash(request, success("Line created"))
  );
}

export default function NewStockTransferLinesRoute() {
  const { id } = useParams();
  if (!id) throw new Error("Could not find id");
  const navigate = useNavigate();
  const routeData = useRouteData<{
    stockTransfer: StockTransfer;
  }>(path.to.stockTransfer(id));

  if (!routeData?.stockTransfer?.locationId)
    throw new Error("No location found");

  const initialValues = {
    stockTransferId: id,
    itemId: "",
    quantity: 1,
    fromShelfId: "",
    toShelfId: "",
  };

  return (
    <StockTransferLineForm
      locationId={routeData?.stockTransfer.locationId}
      onClose={() => navigate(-1)}
      initialValues={initialValues}
    />
  );
}
