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
import { pickListStatusType } from "../../inventory.models";
import type { PickList } from "../../types";
import PickListStatus from "./PickListStatus";

type PickListsTableProps = {
  data: PickList[];
  count: number;
};

const PickListsTable = memo(({ data, count }: PickListsTableProps) => {
  useRealtime("shipment", `id=in.(${data.map((d) => d.id).join(",")})`);

  const [params] = useUrlParams();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const rows = useMemo(() => data, [data]);
  const [people] = usePeople();

  const customColumns = useCustomColumns<PickList>("pickList");
  const locations = useLocations();

  const columns = useMemo<ColumnDef<PickList>[]>(() => {
    const result: ColumnDef<(typeof rows)[number]>[] = [
      {
        accessorKey: "pickListId",
        header: "Pick List ID",
        cell: ({ row }) => (
          <Hyperlink to={path.to.pickListDetails(row.original.id!)}>
            {row.original.pickListId}
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
          const status = item.getValue<(typeof pickListStatusType)[number]>();
          return <PickListStatus status={status} />;
        },
        meta: {
          filter: {
            type: "static",
            options: pickListStatusType.map((type) => ({
              value: type,
              label: <PickListStatus status={type} />,
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

  const [selectedPickList, setSelectedPickList] = useState<PickList | null>(
    null
  );
  const deletePickListModal = useDisclosure();

  const renderContextMenu = useCallback(
    (row: PickList) => {
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
            {row.completedAt ? "View Pick List" : "Edit Pick List"}
          </MenuItem>
          <MenuItem
            disabled={
              !permissions.can("delete", "inventory") ||
              !!row.completedAt ||
              row.status === "Completed"
            }
            destructive
            onClick={() => {
              setSelectedPickList(row);
              deletePickListModal.onOpen();
            }}
          >
            <MenuIcon icon={<LuTrash />} />
            Delete Pick List
          </MenuItem>
        </>
      );
    },
    [deletePickListModal, navigate, params, permissions]
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
            <New label="PickList" to={path.to.newPickList} />
          )
        }
        renderContextMenu={renderContextMenu}
        title="Pick Lists"
        table="pickList"
        withSavedView
      />
      {selectedPickList && selectedPickList.id && (
        <ConfirmDelete
          action={path.to.deletePickList(selectedPickList.id)}
          isOpen={deletePickListModal.isOpen}
          name={selectedPickList.pickListId!}
          text={`Are you sure you want to delete ${selectedPickList.pickListId!}? This cannot be undone.`}
          onCancel={() => {
            deletePickListModal.onClose();
            setSelectedPickList(null);
          }}
          onSubmit={() => {
            deletePickListModal.onClose();
            setSelectedPickList(null);
          }}
        />
      )}
    </>
  );
});

PickListsTable.displayName = "PickListsTable";
export default PickListsTable;
