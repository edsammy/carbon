import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  IconButton,
  VStack,
  cn,
} from "@carbon/react";
import { getItemReadableId } from "@carbon/utils";
import { useParams } from "@remix-run/react";
import { useMemo } from "react";
import {
  LuCircleCheck,
  LuEllipsisVertical,
  LuPencilLine,
  LuTrash,
} from "react-icons/lu";
import { Empty, ItemThumbnail } from "~/components";
import { Enumerable } from "~/components/Enumerable";
import { useLocations } from "~/components/Form/Location";
import { useUnitOfMeasure } from "~/components/Form/UnitOfMeasure";
import { useRouteData } from "~/hooks";
import type { StockTransfer, StockTransferLine } from "~/modules/inventory";
import { useItems } from "~/stores";
import { path } from "~/utils/path";

export default function StockTransferLines() {
  const params = useParams();
  const { id } = params;
  if (!id) throw new Error("stock transfer id not found");

  const [items] = useItems();
  const unitsOfMeasure = useUnitOfMeasure();
  const locations = useLocations();

  const routeData = useRouteData<{
    stockTransfer: StockTransfer;
    stockTransferLines: StockTransferLine[];
  }>(path.to.stockTransfer(id));

  const isPickable = ["Released", "In Progress"].includes(
    routeData?.stockTransfer?.status ?? ""
  );

  const isEditable = ["Draft", "Released", "In Progress"].includes(
    routeData?.stockTransfer?.status ?? ""
  );

  // read-only shelves; no update handler

  const lines = useMemo(() => {
    const list = routeData?.stockTransferLines ?? [];
    return list
      .map((line) => ({
        ...line,
        itemReadableId: getItemReadableId(items, line.itemId) ?? "",
      }))
      .sort((a, b) => a.itemReadableId.localeCompare(b.itemReadableId));
  }, [routeData?.stockTransferLines, items]);

  return (
    <Card>
      <HStack className="justify-between items-start">
        <CardHeader>
          <CardTitle>Stock Transfer Lines</CardTitle>
          <CardDescription>
            <Enumerable
              value={
                locations?.find(
                  (l) => l.value === routeData?.stockTransfer?.locationId
                )?.label ?? null
              }
            />
          </CardDescription>
        </CardHeader>
      </HStack>

      <CardContent>
        <div className="border rounded-lg">
          {lines.length === 0 ? (
            <Empty className="py-6" />
          ) : (
            lines.map((line, index) => {
              const item = items.find((p) => p.id === line.itemId);
              return (
                <div
                  key={line.id}
                  className={cn(
                    "flex flex-col border-b p-6 gap-6",
                    index === lines.length - 1 && "border-none"
                  )}
                >
                  <div className="flex justify-between items-center w-full">
                    <HStack spacing={4} className="w-1/2 justify-between">
                      <HStack spacing={4}>
                        <ItemThumbnail
                          size="md"
                          thumbnailPath={line.thumbnailPath}
                          type={(item?.type as "Part") ?? "Part"}
                        />
                        <VStack spacing={0} className="max-w-[380px] w-full">
                          <div className="w-full overflow-hidden">
                            <span className="text-sm font-medium truncate block w-full">
                              {item?.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate block w-full">
                              {item?.readableIdWithRevision}
                            </span>
                          </div>
                          <div className="mt-2">
                            <Enumerable
                              value={
                                unitsOfMeasure?.find(
                                  (u) => u.value === line.unitOfMeasure
                                )?.label ?? null
                              }
                            />
                          </div>
                        </VStack>
                      </HStack>
                      <VStack spacing={1} className="text-center items-center">
                        <label className="text-xs text-muted-foreground">
                          Quantity
                        </label>
                        <span className="text-sm py-1.5">
                          {line.quantity ?? 0}
                        </span>
                      </VStack>
                    </HStack>
                    <div className="flex flex-grow items-center justify-between gap-8 pl-4 w-1/2">
                      <HStack spacing={8} className="text-center items-center">
                        {"fromShelfId" in line && (
                          <VStack
                            spacing={1}
                            className="text-center items-center"
                          >
                            <label className="text-xs text-muted-foreground">
                              From
                            </label>
                            <span className="text-sm py-1.5 whitespace-nowrap">
                              {line.fromShelfName ?? ""}
                            </span>
                          </VStack>
                        )}
                        {"toShelfId" in line && (
                          <VStack
                            spacing={1}
                            className="text-center items-center"
                          >
                            <label className="text-xs text-muted-foreground">
                              To
                            </label>
                            <span className="text-sm py-1.5 whitespace-nowrap">
                              {line.toShelfName ?? ""}
                            </span>
                          </VStack>
                        )}
                      </HStack>
                      <HStack spacing={1}>
                        <Button
                          isDisabled={!isPickable}
                          leftIcon={<LuCircleCheck />}
                        >
                          Pick
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              variant="secondary"
                              isDisabled={!isEditable}
                              icon={<LuEllipsisVertical />}
                              aria-label="Line options"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <DropdownMenuIcon icon={<LuPencilLine />} />
                              Edit Line
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!isEditable}
                              destructive
                            >
                              <DropdownMenuIcon icon={<LuTrash />} />
                              Delete Line
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </HStack>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// removed editable Shelf component
