import { Status } from "@carbon/react";
import type { shipmentStatusType } from "~/modules/inventory";

type ShipmentStatusProps = {
  status?: (typeof shipmentStatusType)[number] | null;
  invoiced?: boolean | null;
  voided?: boolean | null;
};

const ShipmentStatus = ({ status, invoiced, voided }: ShipmentStatusProps) => {
  if (invoiced && status !== "Voided") {
    return <Status color="blue">Invoiced</Status>;
  }
  switch (status) {
    case "Draft":
      return <Status color="gray">{status}</Status>;
    case "Pending":
      return <Status color="orange">{status}</Status>;
    case "Posted":
      return <Status color="green">{status}</Status>;
    case "Voided":
      return <Status color="red">{status}</Status>;
    default:
      return null;
  }
};

export default ShipmentStatus;
