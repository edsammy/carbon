import { assertIsPost, error, notFound, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { useRouteData } from "@carbon/remix";
import { useNavigate, useParams } from "@remix-run/react";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import {
  stockTransferLineValidator,
  upsertStockTransferLine,
} from "~/modules/inventory";
import type {
  StockTransfer,
  StockTransferLine,
} from "~/modules/inventory/types";
import StockTransferLineForm from "~/modules/inventory/ui/StockTransfers/StockTransferLineForm";

import { path } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, userId } = await requirePermissions(request, {
    create: "inventory",
  });

  const { id, lineId } = params;
  if (!id) throw notFound("id not found");
  if (!lineId) throw notFound("lineId not found");

  const formData = await request.formData();

  const validation = await validator(stockTransferLineValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { id: _id, ...data } = validation.data;

  const updateStockTransferLine = await upsertStockTransferLine(client, {
    id: lineId,
    ...data,
    updatedBy: userId,
  });
  if (updateStockTransferLine.error) {
    return json(
      {},
      await flash(
        request,
        error(updateStockTransferLine.error, "Failed to update line")
      )
    );
  }

  return redirect(
    path.to.stockTransfer(id),
    await flash(request, success("Line updated"))
  );
}

export default function NewStockTransferLinesRoute() {
  const { id, lineId } = useParams();
  if (!id) throw new Error("Could not find id");
  if (!lineId) throw new Error("Could not find lineId");
  const navigate = useNavigate();
  const routeData = useRouteData<{
    stockTransfer: StockTransfer;
    stockTransferLines: StockTransferLine[];
  }>(path.to.stockTransfer(id));

  if (!routeData?.stockTransfer?.locationId)
    throw new Error("No location found");

  const line = routeData?.stockTransferLines?.find(
    (line) => line.id === lineId
  );

  const initialValues = {
    id: lineId,
    stockTransferId: id,
    itemId: line?.itemId ?? "",
    quantity: line?.quantity ?? 1,
    fromShelfId: line?.fromShelfId ?? "",
    toShelfId: line?.toShelfId ?? "",
  };

  return (
    <StockTransferLineForm
      locationId={routeData?.stockTransfer.locationId}
      onClose={() => navigate(-1)}
      initialValues={initialValues}
    />
  );
}
