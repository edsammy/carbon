import { MenuIcon, MenuItem, useDisclosure } from "@carbon/react";
import { formatDate } from "@carbon/utils";
import { useNavigate } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useCallback, useMemo, useState } from "react";
import {
  LuBookMarked,
  LuCalendar,
  LuClock,
  LuMapPin,
  LuPencil,
  LuTrash,
  LuUser,
} from "react-icons/lu";
import { EmployeeAvatar, Hyperlink, New, Table } from "~/components";
import { Enumerable } from "~/components/Enumerable";
import { useLocations } from "~/components/Form/Location";
import { ConfirmDelete } from "~/components/Modals";
import { usePermissions, useRealtime, useUrlParams } from "~/hooks";
import { useCustomColumns } from "~/hooks/useCustomColumns";
import { usePeople } from "~/stores";
import { path } from "~/utils/path";
import { stockTransferStatusType } from "../../inventory.models";
import type { StockTransfer } from "../../types";
import StockTransferStatus from "./StockTransferStatus";

type StockTransfersTableProps = {
  data: StockTransfer[];
  count: number;
};

const StockTransfersTable = memo(
  ({ data, count }: StockTransfersTableProps) => {
    useRealtime("shipment", `id=in.(${data.map((d) => d.id).join(",")})`);

    const [params] = useUrlParams();
    const navigate = useNavigate();
    const permissions = usePermissions();

    const rows = useMemo(() => data, [data]);
    const [people] = usePeople();

    const customColumns = useCustomColumns<StockTransfer>("stockTransfer");
    const locations = useLocations();

    const columns = useMemo<ColumnDef<StockTransfer>[]>(() => {
      const result: ColumnDef<(typeof rows)[number]>[] = [
        {
          accessorKey: "stockTransferId",
          header: "Stock Transfer ID",
          cell: ({ row }) => (
            <Hyperlink to={path.to.stockTransferDetails(row.original.id!)}>
              {row.original.stockTransferId}
            </Hyperlink>
          ),
          meta: {
            icon: <LuBookMarked />,
          },
        },
        {
          accessorKey: "locationId",
          header: "Location",
          cell: ({ row }) => (
            <Enumerable
              value={
                locations.find((l) => l.value === row.original.locationId)
                  ?.label ?? null
              }
            />
          ),
          meta: {
            filter: {
              type: "static",
              options: locations.map((type) => ({
                value: type.value,
                label: <Enumerable value={type.label} />,
              })),
            },
            icon: <LuMapPin />,
          },
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: (item) => {
            const status =
              item.getValue<(typeof stockTransferStatusType)[number]>();
            return <StockTransferStatus status={status} />;
          },
          meta: {
            filter: {
              type: "static",
              options: stockTransferStatusType.map((type) => ({
                value: type,
                label: <StockTransferStatus status={type} />,
              })),
            },
            pluralHeader: "Statuses",
            icon: <LuClock />,
          },
        },
        {
          accessorKey: "assignee",
          header: "Assignee",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.assignee} />
          ),
          meta: {
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
            icon: <LuUser />,
          },
        },
        {
          accessorKey: "assignee",
          header: "Assignee",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.assignee} />
          ),
          meta: {
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
            icon: <LuUser />,
          },
        },
        {
          accessorKey: "completedAt",
          header: "Created At",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuCalendar />,
          },
        },
        {
          id: "createdBy",
          header: "Created By",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.createdBy} />
          ),
          meta: {
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
            icon: <LuUser />,
          },
        },
        {
          accessorKey: "createdAt",
          header: "Created At",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuCalendar />,
          },
        },
        {
          id: "updatedBy",
          header: "Updated By",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.updatedBy} />
          ),
          meta: {
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
            icon: <LuUser />,
          },
        },
        {
          accessorKey: "updatedAt",
          header: "Updated At",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuCalendar />,
          },
        },
      ];

      return [...result, ...customColumns];
    }, [locations, people, customColumns]);

    const [selectedStockTransfer, setSelectedStockTransfer] =
      useState<StockTransfer | null>(null);
    const deleteStockTransferModal = useDisclosure();

    const renderContextMenu = useCallback(
      (row: StockTransfer) => {
        return (
          <>
            <MenuItem
              disabled={!permissions.can("update", "inventory")}
              onClick={() => {
                navigate(
                  `${path.to.shipmentDetails(row.id!)}?${params.toString()}`
                );
              }}
            >
              <MenuIcon icon={<LuPencil />} />
              {row.completedAt ? "View Stock Transfer" : "Edit Stock Transfer"}
            </MenuItem>
            <MenuItem
              disabled={
                !permissions.can("delete", "inventory") ||
                !!row.completedAt ||
                row.status === "Completed"
              }
              destructive
              onClick={() => {
                setSelectedStockTransfer(row);
                deleteStockTransferModal.onOpen();
              }}
            >
              <MenuIcon icon={<LuTrash />} />
              Delete Stock Transfer
            </MenuItem>
          </>
        );
      },
      [deleteStockTransferModal, navigate, params, permissions]
    );

    return (
      <>
        <Table<(typeof data)[number]>
          data={data}
          columns={columns}
          count={count}
          defaultColumnPinning={{
            left: ["shipmentId"],
          }}
          defaultColumnVisibility={{
            createdAt: false,
            createdBy: false,
            updatedAt: false,
            updatedBy: false,
          }}
          primaryAction={
            permissions.can("create", "inventory") && (
              <New label="Stock Transfer" to={path.to.newStockTransfer} />
            )
          }
          renderContextMenu={renderContextMenu}
          title="Stock Transfers"
          table="stockTransfer"
          withSavedView
        />
        {selectedStockTransfer && selectedStockTransfer.id && (
          <ConfirmDelete
            action={path.to.deleteStockTransfer(selectedStockTransfer.id)}
            isOpen={deleteStockTransferModal.isOpen}
            name={selectedStockTransfer.stockTransferId!}
            text={`Are you sure you want to delete ${selectedStockTransfer.stockTransferId!}? This cannot be undone.`}
            onCancel={() => {
              deleteStockTransferModal.onClose();
              setSelectedStockTransfer(null);
            }}
            onSubmit={() => {
              deleteStockTransferModal.onClose();
              setSelectedStockTransfer(null);
            }}
          />
        )}
      </>
    );
  }
);

StockTransfersTable.displayName = "StockTransfersTable";
export default StockTransfersTable;
