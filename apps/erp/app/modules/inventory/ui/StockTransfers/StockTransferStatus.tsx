import { Status } from "@carbon/react";
import type { stockTransferStatusType } from "~/modules/inventory";

type StockTransferStatusProps = {
  status?: (typeof stockTransferStatusType)[number] | null;
};

const StockTransferStatus = ({ status }: StockTransferStatusProps) => {
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

export default StockTransferStatus;
