import { assertIsPost, error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { useParams } from "@remix-run/react";
import type { ActionFunctionArgs } from "@vercel/remix";
import { redirect } from "@vercel/remix";
import { useRouteData, useUser } from "~/hooks";
import type { Customer, SalesOrder, SalesOrderLineType } from "~/modules/sales";
import { salesOrderLineValidator, upsertSalesOrderLine } from "~/modules/sales";
import { SalesOrderLineForm } from "~/modules/sales/ui/SalesOrder";
import { setCustomFields } from "~/utils/form";
import { path } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "sales",
  });

  const { orderId } = params;
  if (!orderId) throw new Error("Could not find orderId");

  const formData = await request.formData();
  const validation = await validator(salesOrderLineValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { id, ...data } = validation.data;

  const createSalesOrderLine = await upsertSalesOrderLine(client, {
    ...data,
    companyId,
    createdBy: userId,
    customFields: setCustomFields(formData),
  });

  if (createSalesOrderLine.error) {
    throw redirect(
      path.to.salesOrderDetails(orderId),
      await flash(
        request,
        error(createSalesOrderLine.error, "Failed to create sales order line.")
      )
    );
  }

  throw redirect(path.to.salesOrderDetails(orderId));
}

export default function NewSalesOrderLineRoute() {
  const { defaults } = useUser();
  const { orderId } = useParams();
  if (!orderId) throw new Error("Could not find orderId");
  const salesOrderData = useRouteData<{
    salesOrder: SalesOrder;
    customer: Customer;
  }>(path.to.salesOrder(orderId));

  const initialValues = {
    salesOrderId: orderId,
    salesOrderLineType: "Part" as SalesOrderLineType,
    itemId: "",
    saleQuantity: 1,
    setupPrice: 0,
    shelfId: "",
    unitOfMeasureCode: "",
    unitPrice: 0,
    locationId:
      salesOrderData?.salesOrder?.locationId ?? defaults.locationId ?? "",
    taxPercent: salesOrderData?.customer?.taxPercent ?? 0,
    promisedDate:
      salesOrderData?.salesOrder?.receiptPromisedDate ??
      salesOrderData?.salesOrder?.receiptRequestedDate ??
      "",
    shippingCost: 0,
  };

  return (
    <SalesOrderLineForm
      // @ts-ignore
      initialValues={initialValues}
    />
  );
}
