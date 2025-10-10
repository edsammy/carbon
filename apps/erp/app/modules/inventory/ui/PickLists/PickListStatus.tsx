import { Status } from "@carbon/react";
import type { pickListStatusType } from "~/modules/inventory";

type PickListStatusProps = {
  status?: (typeof pickListStatusType)[number] | null;
  invoiced?: boolean | null;
  voided?: boolean | null;
};

const PickListStatus = ({ status, invoiced, voided }: PickListStatusProps) => {
  switch (status) {
    case "Draft":
      return <Status color="gray">{status}</Status>;
    case "Released":
      return <Status color="orange">{status}</Status>;
    case "In Progress":
      return <Status color="blue">{status}</Status>;
    case "Completed":
      return <Status color="green">{status}</Status>;
    default:
      return null;
  }
};

export default PickListStatus;
