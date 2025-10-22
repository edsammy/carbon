import {
  Button,
  Combobox,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  HStack,
  PulsingDot,
  Status,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  VStack,
} from "@carbon/react";
import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { useDateFormatter, useNumberFormatter } from "@react-aria/i18n";
import { useFetcher } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  LuBookMarked,
  LuBox,
  LuCircleCheck,
  LuCirclePlay,
  LuClock,
  LuContainer,
  LuPackage,
  LuSquareChartGantt,
} from "react-icons/lu";
import {
  ItemThumbnail,
  MethodItemTypeIcon,
  SupplierAvatar,
  Table,
} from "~/components";
import { Enumerable } from "~/components/Enumerable";
import { useLocations } from "~/components/Form/Location";
import { useUnitOfMeasure } from "~/components/Form/UnitOfMeasure";
import { usePermissions } from "~/hooks";
import { itemTypes } from "~/modules/inventory/inventory.models";
import { itemReorderingPolicies } from "~/modules/items/items.models";
import type { SupplierPart } from "~/modules/items/types";
import {
  getPurchaseOrdersFromPlanning,
  getReorderPolicyDescription,
  ItemReorderPolicy,
} from "~/modules/items/ui/Item/ItemReorderPolicy";
import type { action as mrpAction } from "~/routes/api+/mrp";
import type { action as bulkUpdateAction } from "~/routes/x+/production+/planning.update";
import { useItems } from "~/stores";
import { useSuppliers } from "~/stores/suppliers";
import { path } from "~/utils/path";
import type { PlannedOrder } from "../../purchasing.models";
import type { PurchasingPlanningItem } from "../../types";
import { PurchasingPlanningOrderDrawer } from "./PurchasingPlanningOrderDrawer";

type PlanningTableProps = {
  data: PurchasingPlanningItem[];
  count: number;
  locationId: string;
  periods: { id: string; startDate: string; endDate: string }[];
};

const PlanningTable = memo(
  ({ data, count, locationId, periods }: PlanningTableProps) => {
    const permissions = usePermissions();

    const dateFormatter = useDateFormatter({
      month: "short",
      day: "numeric",
    });

    const numberFormatter = useNumberFormatter();
    const locations = useLocations();
    const unitOfMeasures = useUnitOfMeasure();
    const [suppliers] = useSuppliers();

    const mrpFetcher = useFetcher<typeof mrpAction>();
    const bulkUpdateFetcher = useFetcher<typeof bulkUpdateAction>();

    const [suppliersMap, setSuppliersMap] = useState<Record<string, string>>(
      () => {
        const initial: Record<string, string> = {};
        data.forEach((item) => {
          // If there's a preferred supplier, use it
          if (item.preferredSupplierId) {
            initial[item.id] = item.preferredSupplierId;
          }
          // If there's only one supplier, auto-select it regardless of preference
          else if ((item.suppliers as SupplierPart[])?.length === 1) {
            initial[item.id] = (item.suppliers as SupplierPart[])[0].supplierId;
          }
          // Otherwise, use the first available supplier if any
          else if ((item.suppliers as SupplierPart[])?.length > 0) {
            initial[item.id] = (item.suppliers as SupplierPart[])[0].supplierId;
          }
        });

        return initial;
      }
    );

    console.log(suppliersMap);
    const isDisabled =
      !permissions.can("create", "production") ||
      bulkUpdateFetcher.state !== "idle" ||
      mrpFetcher.state !== "idle";

    const [items] = useItems();

    const getOrders = useCallback(() => {
      const initialMap: Record<string, PlannedOrder[]> = {};
      data.forEach((item) => {
        if (item.id) {
          initialMap[item.id] = getPurchaseOrdersFromPlanning(
            item,
            periods,
            items,
            suppliersMap[item.id]
          );
        }
      });
      return initialMap;
    }, [data, periods, suppliersMap, items]);

    const [ordersMap, setOrdersMap] =
      useState<Record<string, PlannedOrder[]>>(getOrders);

    useEffect(() => {
      setOrdersMap(getOrders());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const onBulkUpdate = useCallback(
      (selectedRows: typeof data, action: "order") => {
        const payload = {
          locationId,
          items: selectedRows
            .filter((row) => row.id)
            .map((row) => {
              const ordersWithPeriods = (ordersMap[row.id!] || []).map(
                (order) => {
                  if (
                    !order.dueDate ||
                    parseDate(order.dueDate) < parseDate(periods[0].startDate)
                  ) {
                    return {
                      ...order,
                      periodId: periods[0].id,
                    };
                  }

                  const period = periods.find((p) => {
                    const dueDate = parseDate(order.dueDate!);
                    const startDate = parseDate(p.startDate);
                    const endDate = parseDate(p.endDate);
                    return dueDate >= startDate && dueDate <= endDate;
                  });

                  return {
                    ...order,
                    supplierId: suppliersMap[row.id!],
                    periodId: period?.id ?? periods[periods.length - 1].id,
                  };
                }
              );

              return {
                id: row.id,
                orders: ordersWithPeriods,
              };
            }),
          action: action,
        };
        bulkUpdateFetcher.submit(payload, {
          method: "post",
          action: path.to.bulkUpdatePurchasingPlanning,
          encType: "application/json",
        });
      },
      [bulkUpdateFetcher, locationId, ordersMap, periods, suppliersMap]
    );

    const [selectedItem, setSelectedItem] =
      useState<PurchasingPlanningItem | null>(null);

    const setOrders = useCallback(
      (item: PurchasingPlanningItem, orders: PlannedOrder[]) => {
        if (item.id) {
          setOrdersMap((prev) => ({
            ...prev,
            [item.id!]: orders,
          }));
        }
      },
      []
    );

    const columns = useMemo<ColumnDef<PurchasingPlanningItem>[]>(() => {
      const periodColumns: ColumnDef<PurchasingPlanningItem>[] = periods.map(
        (period, index) => {
          const isCurrentWeek = index === 0;
          const weekNumber = index + 1;
          const weekKey = `week${weekNumber}` as keyof PurchasingPlanningItem;
          const startDate = parseDate(period.startDate).toDate(
            getLocalTimeZone()
          );
          const endDate = parseDate(period.endDate).toDate(getLocalTimeZone());

          return {
            accessorKey: weekKey,
            header: () => (
              <VStack spacing={0}>
                <div>
                  {isCurrentWeek ? "Present Week" : `Week ${weekNumber}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dateFormatter.format(startDate)} -{" "}
                  {dateFormatter.format(endDate)}
                </div>
              </VStack>
            ),
            cell: ({ row }) => {
              const value = row.getValue<number>(weekKey);
              if (value === undefined) return "-";
              return (
                <span
                  className={value < 0 ? "text-red-500 font-bold" : undefined}
                >
                  {numberFormatter.format(value)}
                </span>
              );
            },
          };
        }
      );

      return [
        {
          accessorKey: "readableIdWithRevision",
          header: "Part ID",
          cell: ({ row }) => (
            <HStack
              className="py-1 cursor-pointer"
              onClick={() => {
                setSelectedItem(row.original);
              }}
            >
              <ItemThumbnail
                size="sm"
                thumbnailPath={row.original.thumbnailPath}
                type={row.original.type as "Part"}
              />

              <VStack spacing={0} className="font-medium">
                {row.original.readableIdWithRevision}
                <div className="w-full truncate text-muted-foreground text-xs">
                  {row.original.name}
                </div>
              </VStack>
            </HStack>
          ),
          meta: {
            icon: <LuBookMarked />,
          },
        },
        {
          accessorKey: "unitOfMeasureCode",
          header: "",
          cell: ({ row }) => (
            <Enumerable
              value={
                unitOfMeasures.find(
                  (uom) => uom.value === row.original.unitOfMeasureCode
                )?.label ?? null
              }
            />
          ),
        },
        {
          accessorKey: "preferredSupplierId",
          header: "Supplier",
          cell: ({ row }) => {
            const supplierId = suppliersMap[row.original.id];
            if (!supplierId) return <Status color="red">No Supplier</Status>;

            return <SupplierAvatar supplierId={supplierId} />;
          },
          meta: {
            filter: {
              type: "static",
              options: suppliers.map((supplier) => ({
                label: supplier.name,
                value: supplier.id,
              })),
            },
            icon: <LuContainer />,
          },
        },
        {
          accessorKey: "leadTime",
          header: "Lead Time",
          cell: ({ row }) => {
            const leadTime = row.original.leadTime;
            const weeks = Math.ceil(leadTime / 7);
            return (
              <span>
                {weeks} week{weeks > 1 ? "s" : ""}
              </span>
            );
          },
          meta: {
            icon: <LuClock />,
          },
        },
        {
          accessorKey: "reorderingPolicy",
          header: "Reorder Policy",
          cell: ({ row }) => {
            return (
              <HStack>
                <Tooltip>
                  <TooltipTrigger>
                    <ItemReorderPolicy
                      reorderingPolicy={row.original.reorderingPolicy}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {getReorderPolicyDescription(row.original)}
                  </TooltipContent>
                </Tooltip>
              </HStack>
            );
          },
          meta: {
            filter: {
              type: "static",
              options: itemReorderingPolicies.map((policy) => ({
                label: <ItemReorderPolicy reorderingPolicy={policy} />,
                value: policy,
              })),
            },
            icon: <LuCircleCheck />,
          },
        },
        {
          accessorKey: "quantityOnHand",
          header: "On Hand",
          cell: ({ row }) =>
            numberFormatter.format(row.original.quantityOnHand),
          meta: {
            icon: <LuPackage />,
          },
        },
        ...periodColumns,
        {
          accessorKey: "type",
          header: "Type",
          cell: ({ row }) =>
            row.original.type && (
              <HStack>
                <MethodItemTypeIcon type={row.original.type} />
                <span>{row.original.type}</span>
              </HStack>
            ),
          meta: {
            filter: {
              type: "static",
              options: itemTypes
                .filter((t) => ["Part", "Tool"].includes(t))
                .map((type) => ({
                  label: (
                    <HStack spacing={2}>
                      <MethodItemTypeIcon type={type} />
                      <span>{type}</span>
                    </HStack>
                  ),
                  value: type,
                })),
            },
            icon: <LuBox />,
          },
        },
        {
          id: "Order",
          header: "",
          cell: ({ row }) => {
            const orders = row.original.id
              ? ordersMap[row.original.id] || []
              : [];
            const orderQuantity = orders.reduce(
              (acc, order) =>
                acc + (order.quantity - (order.existingQuantity ?? 0)),
              0
            );
            const isBlocked = row.original.purchasingBlocked;
            const hasOrders = orders.length > 0 && orderQuantity > 0;
            return (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  leftIcon={hasOrders ? undefined : <LuCircleCheck />}
                  isDisabled={isDisabled || isBlocked}
                  onClick={() => {
                    setSelectedItem(row.original);
                  }}
                >
                  {isBlocked ? (
                    "Blocked"
                  ) : hasOrders ? (
                    <HStack>
                      <PulsingDot />
                      <span>Order {orderQuantity}</span>
                    </HStack>
                  ) : (
                    "Order"
                  )}
                </Button>
              </div>
            );
          },
        },
      ];
    }, [
      periods,
      suppliers,
      dateFormatter,
      numberFormatter,
      unitOfMeasures,
      suppliersMap,
      ordersMap,
      isDisabled,
    ]);

    const renderActions = useCallback(
      (selectedRows: typeof data) => {
        return (
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuLabel>Update</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => onBulkUpdate(selectedRows, "order")}
              disabled={bulkUpdateFetcher.state !== "idle"}
            >
              <DropdownMenuIcon icon={<LuSquareChartGantt />} />
              Order Parts
            </DropdownMenuItem>
          </DropdownMenuContent>
        );
      },
      [bulkUpdateFetcher.state, onBulkUpdate]
    );

    const defaultColumnVisibility = {
      active: false,
      type: false,
    };

    const defaultColumnPinning = {
      left: ["readableIdWithRevision"],
      right: ["Order"],
    };

    return (
      <>
        <Table<PurchasingPlanningItem>
          count={count}
          columns={columns}
          data={data}
          defaultColumnVisibility={defaultColumnVisibility}
          defaultColumnPinning={defaultColumnPinning}
          primaryAction={
            <div className="flex items-center gap-2">
              <Combobox
                asButton
                size="sm"
                value={locationId}
                options={locations}
                onChange={(selected) => {
                  window.location.href = getLocationPath(selected);
                }}
              />
              <mrpFetcher.Form
                method="post"
                action={path.to.api.mrp(locationId)}
              >
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      type="submit"
                      variant="secondary"
                      rightIcon={<LuCirclePlay />}
                      isDisabled={mrpFetcher.state !== "idle"}
                      isLoading={mrpFetcher.state !== "idle"}
                    >
                      Recalculate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    MRP runs automatically every 3 hours, but you can run it
                    manually here.
                  </TooltipContent>
                </Tooltip>
              </mrpFetcher.Form>
            </div>
          }
          renderActions={renderActions}
          title="Planning"
          table="planning"
          withSavedView
          withSelectableRows
        />

        {selectedItem && (
          <PurchasingPlanningOrderDrawer
            locationId={locationId}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            selectedSupplier={suppliersMap[selectedItem.id]}
            orders={selectedItem.id ? ordersMap[selectedItem.id] || [] : []}
            setOrders={setOrders}
            periods={periods}
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            onSupplierChange={(itemId, supplierId) => {
              setSuppliersMap((prev) => ({
                ...prev,
                [itemId]: supplierId,
              }));
            }}
          />
        )}
      </>
    );
  }
);

PlanningTable.displayName = "PlanningTable";

export default PlanningTable;

function getLocationPath(locationId: string) {
  return `${path.to.purchasingPlanning}?location=${locationId}`;
}
