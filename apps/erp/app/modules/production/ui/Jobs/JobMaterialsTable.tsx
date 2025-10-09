import { Badge, Button, cn, HStack, VStack } from "@carbon/react";
import { useNumberFormatter } from "@react-aria/i18n";
import { useFetcher, useParams } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useMemo } from "react";
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowUp,
  LuBookMarked,
  LuCircleCheck,
  LuFlag,
  LuGitPullRequest,
  LuHash,
  LuRefreshCcwDot,
} from "react-icons/lu";
import {
  Hyperlink,
  ItemThumbnail,
  MethodIcon,
  Table,
  TrackingTypeIcon,
} from "~/components";
import { usePermissions, useRouteData } from "~/hooks";
import { useBom, useItems } from "~/stores";
import { path } from "~/utils/path";
import type { Job, JobMaterial } from "../../types";

type JobMaterialsTableProps = {
  data: JobMaterial[];
  count: number;
};
const JobMaterialsTable = memo(({ data, count }: JobMaterialsTableProps) => {
  const { jobId } = useParams();
  if (!jobId) throw new Error("Job ID is required");

  const routeData = useRouteData<{ job: Job }>(path.to.job(jobId));
  const isAllocated = ["Planned", "Ready", "In Progress", "Paused"].includes(
    routeData?.job?.status ?? ""
  );

  const fetcher = useFetcher<{}>();
  const formatter = useNumberFormatter();

  const [items] = useItems();
  const [, setSelectedMaterialId] = useBom();

  const columns = useMemo<ColumnDef<JobMaterial>[]>(() => {
    return [
      {
        accessorKey: "readableIdWithRevision",
        header: "Item",
        cell: ({ row }) => (
          <HStack className="py-1">
            <ItemThumbnail
              size="md"
              // @ts-ignore
              type={row.original.itemType}
            />

            <VStack spacing={0}>
              <Hyperlink
                to={path.to.jobMakeMethod(jobId, row.original.jobMakeMethodId)}
                onClick={() => {
                  setSelectedMaterialId(row.original.id ?? null);
                }}
                className="max-w-[260px] truncate"
              >
                {row.original.itemReadableId}
              </Hyperlink>
              <div className="w-full truncate text-muted-foreground text-xs">
                {row.original.description}
              </div>
            </VStack>
          </HStack>
        ),
        meta: {
          icon: <LuBookMarked />,
          filter: {
            type: "static",
            options: items.map((item) => ({
              value: item.readableIdWithRevision,
              label: item.readableIdWithRevision,
            })),
          },
        },
      },
      {
        accessorKey: "estimatedQuantity",
        header: "Quantity",
        cell: ({ row }) => formatter.format(row.original.estimatedQuantity),
        meta: {
          icon: <LuHash />,
        },
      },
      {
        id: "method",
        header: "Method",
        cell: ({ row }) => (
          <HStack>
            <Badge variant="secondary">
              <MethodIcon
                type={row.original.methodType}
                className="size-3 mr-1"
              />
              {row.original.methodType}
            </Badge>
            <LuArrowLeft
              className={cn(
                row.original.methodType === "Make" ? "rotate-180" : ""
              )}
            />
            <Badge variant="secondary">
              <LuGitPullRequest className="size-3 mr-1" />
              {row.original.shelfName ??
                (row.original.methodType === "Make" ? "WIP" : "Default Shelf")}
            </Badge>
          </HStack>
        ),
      },

      {
        id: "quantityOnHandInShelf",
        header: "On Hand (Shelf)",
        cell: ({ row }) => {
          const isInventoried =
            row.original.itemTrackingType !== "Non-Inventory";
          if (!isInventoried)
            return (
              <Badge variant="secondary">
                <TrackingTypeIcon type="Non-Inventory" className="mr-2" />
                <span>Non-Inventory</span>
              </Badge>
            );

          const quantityRequiredByShelf = isAllocated
            ? row.original.quantityFromProductionOrderInShelf
            : row.original.quantityFromProductionOrderInShelf +
              row.original.estimatedQuantity;

          if (row.original.methodType === "Make") {
            return null;
          }

          const quantityOnHandInShelf = row.original.quantityOnHandInShelf;

          if (quantityOnHandInShelf < quantityRequiredByShelf)
            return (
              <Badge variant="destructive">
                <LuFlag className="mr-2" />
                {quantityOnHandInShelf}
              </Badge>
            );

          return (
            <Badge variant="green">
              <LuCircleCheck className="mr-2" />
              {quantityOnHandInShelf}
            </Badge>
          );
        },
        meta: {
          icon: <LuHash />,
        },
      },
      {
        id: "quantityOnHand",
        header: "On Hand (Total)",
        cell: ({ row }) => {
          if (
            row.original.itemTrackingType === "Non-Inventory" ||
            row.original.methodType === "Make"
          ) {
            return null;
          }
          const quantityOnHand =
            row.original.quantityOnHandInShelf +
            row.original.quantityOnHandNotInShelf;

          const incoming =
            row.original.quantityOnPurchaseOrder +
            row.original.quantityOnProductionOrder;

          const allocated =
            row.original.quantityFromProductionOrderInShelf +
            row.original.quantityFromProductionOrderNotInShelf +
            row.original.quantityOnSalesOrder;

          if (
            quantityOnHand + incoming - allocated <
            (row.original.estimatedQuantity ?? 0)
          ) {
            return (
              <Badge variant="destructive">
                <LuFlag className="mr-2" />
                {quantityOnHand}
              </Badge>
            );
          }
          return quantityOnHand;
        },
        meta: {
          icon: <LuHash />,
        },
      },
      {
        id: "allocated",
        header: "Allocated",
        cell: ({ row }) =>
          row.original.quantityFromProductionOrderInShelf +
          row.original.quantityFromProductionOrderNotInShelf +
          row.original.quantityOnSalesOrder,

        meta: {
          icon: <LuArrowDown className="text-red-600" />,
        },
      },
      {
        id: "incoming",
        header: "Incoming",
        cell: ({ row }) =>
          row.original.quantityOnPurchaseOrder +
          row.original.quantityOnProductionOrder,
        meta: {
          icon: <LuArrowUp className="text-emerald-600" />,
        },
      },
    ];
  }, [items, jobId, setSelectedMaterialId]);

  const permissions = usePermissions();

  return (
    <Table<JobMaterial>
      compact
      count={count}
      columns={columns}
      data={data}
      primaryAction={
        data.length > 0 && permissions.can("update", "production") ? (
          <fetcher.Form action={path.to.jobRecalculate(jobId)} method="post">
            <Button
              leftIcon={<LuRefreshCcwDot />}
              isLoading={fetcher.state !== "idle"}
              isDisabled={fetcher.state !== "idle"}
              type="submit"
              variant="secondary"
            >
              Recalculate
            </Button>
          </fetcher.Form>
        ) : undefined
      }
      title="Materials"
    />
  );
});

JobMaterialsTable.displayName = "JobMaterialsTable";

export default JobMaterialsTable;
