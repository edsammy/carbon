import { Checkbox, MenuIcon, MenuItem, useDisclosure } from "@carbon/react";
import { useNavigate } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useCallback, useMemo, useState } from "react";
import {
  LuBookMarked,
  LuCalendar,
  LuCheck,
  LuContainer,
  LuDroplets,
  LuFileText,
  LuPencil,
  LuShapes,
  LuThermometer,
  LuTrash,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import {
  EmployeeAvatar,
  Hyperlink,
  New,
  SupplierAvatar,
  Table,
} from "~/components";

import { flushSync } from "react-dom";
import { ConfirmDelete } from "~/components/Modals";
import { usePermissions, useRouteData, useUrlParams } from "~/hooks";
import type { ListItem } from "~/types";
import { path } from "~/utils/path";
import type { GaugeCalibrationRecord } from "../../types";

import type { Database } from "@carbon/database";
import { formatDate } from "@carbon/utils";
import { useNumberFormatter } from "@react-aria/i18n";
import { Enumerable } from "~/components/Enumerable";
import { useCustomColumns } from "~/hooks/useCustomColumns";
import { usePeople, useSuppliers } from "~/stores";
import { GaugeCalibrationRecordStatus } from "./GaugeCalibrationRecordStatus";

type GaugeCalibrationRecordsTableProps = {
  data: GaugeCalibrationRecord[];
  types: ListItem[];
  count: number;
};

const defaultColumnVisibility = {
  gaugeTypeId: false,
  createdAt: false,
  updatedAt: false,
  updatedBy: false,
  temperature: false,
  humidity: false,
  approvedBy: false,
};

const GaugeCalibrationRecordsTable = memo(
  ({ data, types, count }: GaugeCalibrationRecordsTableProps) => {
    const [params] = useUrlParams();
    const navigate = useNavigate();
    const permissions = usePermissions();
    const deleteDisclosure = useDisclosure();
    const [selectedGaugeCalibrationRecord, setSelectedGaugeCalibrationRecord] =
      useState<GaugeCalibrationRecord | null>(null);

    const customColumns = useCustomColumns<GaugeCalibrationRecord>(
      "gaugeCalibrationRecord"
    );

    const [people] = usePeople();
    const [suppliers] = useSuppliers();

    const routeData = useRouteData<{
      companySettings: Database["public"]["Tables"]["companySettings"]["Row"];
    }>(path.to.authenticatedRoot);
    const isMetric = routeData?.companySettings?.useMetric ?? false;

    const temperatureFormatter = useNumberFormatter({
      maximumFractionDigits: 2,
      style: "unit",
      unit: isMetric ? "celsius" : "fahrenheit",
    });
    const humidityFormatter = useNumberFormatter({
      maximumFractionDigits: 2,
      style: "percent",
      minimumFractionDigits: 0,
    });

    const columns = useMemo<ColumnDef<GaugeCalibrationRecord>[]>(() => {
      const defaultColumns: ColumnDef<GaugeCalibrationRecord>[] = [
        {
          accessorKey: "gaugeId",
          header: "ID",
          cell: ({ row }) => (
            <Hyperlink to={path.to.gaugeCalibrationRecord(row.original.id!)}>
              <div className="flex flex-col gap-0">
                <span className="text-sm font-medium">
                  {row.original.gaugeReadableId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.original.description}
                </span>
              </div>
            </Hyperlink>
          ),
          meta: {
            icon: <LuBookMarked />,
          },
        },
        {
          accessorKey: "dateCalibrated",
          header: "Date Calibrated",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuCalendar />,
          },
        },
        {
          accessorKey: "inspectionStatus",
          header: "Inspection Status",
          cell: (item) => (
            <GaugeCalibrationRecordStatus
              status={item.getValue<string>() as "Pass" | "Fail"}
            />
          ),
          meta: {
            icon: <LuCheck />,
            filter: {
              type: "static",
              options: [
                {
                  value: "Pass",
                  label: <GaugeCalibrationRecordStatus status="Pass" />,
                },
                {
                  value: "Fail",
                  label: <GaugeCalibrationRecordStatus status="Fail" />,
                },
              ],
            },
          },
        },
        {
          accessorKey: "gaugeTypeId",
          header: "Type",
          cell: ({ row }) => (
            <Enumerable
              value={
                types.find((type) => type.id === row.original.gaugeTypeId)
                  ?.name ?? null
              }
            />
          ),
          meta: {
            icon: <LuShapes />,
            filter: {
              type: "static",
              options: types.map((type) => ({
                label: <Enumerable value={type.name} />,
                value: type.id,
              })),
            },
          },
        },
        {
          accessorKey: "requiresAction",
          header: "Requires Action",
          cell: (item) => <Checkbox isChecked={item.getValue<boolean>()} />,
          meta: {
            filter: {
              type: "static",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
            icon: <LuCheck />,
          },
        },
        {
          accessorKey: "requiresAdjustment",
          header: "Requires Adjustment",
          cell: (item) => <Checkbox isChecked={item.getValue<boolean>()} />,
          meta: {
            filter: {
              type: "static",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
            icon: <LuCheck />,
          },
        },
        {
          accessorKey: "requiresRepair",
          header: "Requires Repair",
          cell: (item) => <Checkbox isChecked={item.getValue<boolean>()} />,
          meta: {
            filter: {
              type: "static",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
            icon: <LuCheck />,
          },
        },

        {
          id: "supplierId",
          header: "Calibration Supplier",
          cell: ({ row }) => (
            <SupplierAvatar supplierId={row.original.supplierId} />
          ),
          meta: {
            filter: {
              type: "static",
              options: suppliers?.map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              })),
            },
            icon: <LuContainer />,
          },
        },

        {
          accessorKey: "temperature",
          header: "Temperature",
          cell: (item) => {
            const value = item.getValue<number | null>();
            return value !== null && value !== undefined
              ? temperatureFormatter.format(value)
              : "—";
          },
          meta: {
            icon: <LuThermometer />,
          },
        },
        {
          accessorKey: "humidity",
          header: "Humidity",
          cell: (item) => {
            const value = item.getValue<number | null>();
            return value !== null && value !== undefined
              ? humidityFormatter.format(value)
              : "—";
          },
          meta: {
            icon: <LuDroplets />,
          },
        },
        {
          id: "approvedBy",
          header: "Approved By",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.approvedBy} />
          ),
          meta: {
            icon: <LuUser />,
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
          },
        },
        {
          id: "createdBy",
          header: "Created By",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.createdBy} />
          ),
          meta: {
            icon: <LuUser />,
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
          },
        },
        {
          accessorKey: "createdAt",
          header: "Created At",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuFileText />,
          },
        },
        {
          id: "updatedBy",
          header: "Updated By",
          cell: ({ row }) => (
            <EmployeeAvatar employeeId={row.original.updatedBy} />
          ),
          meta: {
            icon: <LuUsers />,
            filter: {
              type: "static",
              options: people.map((employee) => ({
                value: employee.id,
                label: employee.name,
              })),
            },
          },
        },
        {
          accessorKey: "updatedAt",
          header: "Updated At",
          cell: (item) => formatDate(item.getValue<string>()),
          meta: {
            icon: <LuFileText />,
          },
        },
      ];
      return [...defaultColumns, ...customColumns];
    }, [
      customColumns,
      humidityFormatter,
      people,
      suppliers,
      temperatureFormatter,
      types,
    ]);

    const renderContextMenu = useCallback(
      (row: GaugeCalibrationRecord) => {
        return (
          <>
            <MenuItem
              disabled={!permissions.can("update", "quality")}
              onClick={() => {
                navigate(
                  `${path.to.gaugeCalibrationRecord(
                    row.id!
                  )}?${params?.toString()}`
                );
              }}
            >
              <MenuIcon icon={<LuPencil />} />
              Edit Record
            </MenuItem>
            <MenuItem
              destructive
              disabled={!permissions.can("delete", "quality")}
              onClick={() => {
                flushSync(() => {
                  setSelectedGaugeCalibrationRecord(row);
                });
                deleteDisclosure.onOpen();
              }}
            >
              <MenuIcon icon={<LuTrash />} />
              Delete Record
            </MenuItem>
          </>
        );
      },
      [navigate, permissions, deleteDisclosure, params]
    );

    return (
      <>
        <Table<GaugeCalibrationRecord>
          data={data}
          columns={columns}
          count={count}
          defaultColumnVisibility={defaultColumnVisibility}
          primaryAction={
            permissions.can("create", "quality") && (
              <New
                label="Record"
                to={`${
                  path.to.newGaugeCalibrationRecord
                }?${params?.toString()}`}
              />
            )
          }
          renderContextMenu={renderContextMenu}
          title="Calibration Records"
          table="gaugeCalibrationRecord"
          withSavedView
        />
        {deleteDisclosure.isOpen && selectedGaugeCalibrationRecord && (
          <ConfirmDelete
            action={path.to.deleteGaugeCalibrationRecord(
              selectedGaugeCalibrationRecord.id!
            )}
            isOpen
            onCancel={() => {
              setSelectedGaugeCalibrationRecord(null);
              deleteDisclosure.onClose();
            }}
            onSubmit={() => {
              setSelectedGaugeCalibrationRecord(null);
              deleteDisclosure.onClose();
            }}
            name={`record for ${
              selectedGaugeCalibrationRecord.gaugeId ?? "gauge"
            }`}
            text="Are you sure you want to delete this record?"
          />
        )}
      </>
    );
  }
);

GaugeCalibrationRecordsTable.displayName = "GaugeCalibrationRecordsTable";
export default GaugeCalibrationRecordsTable;
