import type { Result } from "@carbon/auth";
import { useCarbon } from "@carbon/auth";
import {
  Badge,
  Button,
  cn,
  Combobox,
  Count,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  MenuIcon,
  MenuItem,
  NumberField,
  NumberInput,
  NumberInputGroup,
  PulsingDot,
  ScrollArea,
  Spinner,
  Table as TableBase,
  Tbody,
  Td,
  Th,
  Thead,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Tr,
  useDisclosure,
  useMount,
  VStack,
} from "@carbon/react";
import { formatDate, prettifyKeyboardShortcut } from "@carbon/utils";
import { useNumberFormatter } from "@react-aria/i18n";
import { useFetcher, useNavigate } from "@remix-run/react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";
import {
  LuArrowLeft,
  LuArrowRight,
  LuBookMarked,
  LuCalendar,
  LuCheckCheck,
  LuCirclePlus,
  LuClock,
  LuFlag,
  LuMapPin,
  LuMaximize2,
  LuMinus,
  LuPencil,
  LuSearch,
  LuTrash,
  LuTrash2,
  LuTriangleAlert,
  LuTruck,
  LuUser,
  LuX,
} from "react-icons/lu";
import { EmployeeAvatar, Hyperlink, ItemThumbnail, Table } from "~/components";
import { Enumerable } from "~/components/Enumerable";
import { useLocations } from "~/components/Form/Location";
import { ConfirmDelete } from "~/components/Modals";
import { getAccessorKey } from "~/components/Table/utils";
import { usePermissions, useUrlParams, useUser } from "~/hooks";
import { useCustomColumns } from "~/hooks/useCustomColumns";
import {
  addTransferLine,
  clearSelectedToShelves,
  clearStockTransferWizard,
  hasTransferLine,
  hasTransferLinesToShelf,
  isToShelfSelected,
  removeTransferLine,
  toggleToShelfSelection,
  updateTransferLineQuantity,
  usePeople,
  useStockTransferWizard,
  useStockTransferWizardLinesCount,
} from "~/stores";
import { path } from "~/utils/path";
import { stockTransferStatusType } from "../../inventory.models";
import type { StockTransfer } from "../../types";
import StockTransferStatus from "./StockTransferStatus";

type StockTransfersTableProps = {
  data: StockTransfer[];
  count: number;
  locationId: string;
};

const StockTransfersTable = memo(
  ({ data, count, locationId }: StockTransfersTableProps) => {
    const wizardDisclosure = useDisclosure();

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
            <Hyperlink to={path.to.stockTransfer(row.original.id!)}>
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
          accessorKey: "completedAt",
          header: "Completed At",
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
            updatedAt: false,
            updatedBy: false,
          }}
          primaryAction={
            <div className="flex items-center gap-2">
              <Combobox
                asButton
                size="sm"
                value={locationId}
                options={locations}
                onChange={(selected) => {
                  // hard refresh because initialValues update has no effect otherwise
                  window.location.href = getLocationPath(selected);
                }}
              />
              {permissions.can("create", "inventory") && (
                <Button
                  onClick={wizardDisclosure.onOpen}
                  leftIcon={<LuCirclePlus />}
                >
                  Add Stock Transfer
                </Button>
              )}
            </div>
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
        {wizardDisclosure.isOpen && (
          <StockTransferWizard
            locationId={locationId}
            onClose={wizardDisclosure.onClose}
          />
        )}
      </>
    );
  }
);

StockTransfersTable.displayName = "StockTransfersTable";
export default StockTransfersTable;

function getLocationPath(locationId: string) {
  return `${path.to.stockTransfers}?location=${locationId}`;
}

function StockTransferWizard({
  locationId,
  onClose,
}: {
  locationId: string;
  onClose: () => void;
}) {
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent size="full">
        <DrawerHeader className="px-4">
          <DrawerTitle>Stock Transfer Wizard</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="w-full h-full p-0">
          <TransferGrid locationId={locationId} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

type TransferTableRow = {
  itemId: string;
  itemReadableId: string;
  description: string;
  thumbnailPath: string;
  quantityOnHand: number;
  quantityRequired: number;
  quantityAvailable: number;
  shelfId: string | null;
  shelfName: string | null;
};

function TransferGrid({ locationId }: { locationId: string }) {
  const [pageSize, setPageSize] = useState(100);
  const formatter = useNumberFormatter();

  const { carbon } = useCarbon();
  const {
    company: { id: companyId },
  } = useUser();

  const [wizard] = useStockTransferWizard();

  const [transferTo, setTransferTo] = useState<TransferTableRow[]>([]);
  const [allTransferToData, setAllTransferToData] = useState<
    TransferTableRow[]
  >([]);
  const [transferToSearch, setTransferToSearch] = useState("");
  const [transferToOffset, setTransferToOffset] = useState(0);
  const [transferToIsLoading, setTransferToIsLoading] = useState(false);

  const [transferFrom, setTransferFrom] = useState<TransferTableRow[]>([]);
  const [allTransferFromData, setAllTransferFromData] = useState<
    TransferTableRow[]
  >([]);
  const [transferFromSearch, setTransferFromSearch] = useState("");
  const [transferFromOffset, setTransferFromOffset] = useState(0);
  const [transferFromIsLoading, setTransferFromIsLoading] = useState(false);

  const transferToQuery = useCallback(async () => {
    if (!carbon) return;
    setTransferToIsLoading(true);
    const { data, error } = await carbon.rpc(
      "get_item_shelf_requirements_by_location",
      {
        company_id: companyId,
        location_id: locationId,
      }
    );

    if (error) {
      toast.error(error.message);
      setAllTransferToData([]);
    } else {
      const mappedData =
        data?.map((item) => ({
          itemId: item.itemId,
          itemReadableId: item.itemReadableId,
          description: item.description,
          thumbnailPath: item.thumbnailPath,
          quantityOnHand: item.quantityOnHandInShelf,
          quantityRequired: item.quantityRequiredByShelf,
          quantityAvailable:
            item.quantityOnHandInShelf - item.quantityRequiredByShelf,
          shelfId: item.shelfId,
          shelfName: item.shelfName,
        })) ?? [];
      setAllTransferToData(mappedData);
    }

    setTransferToIsLoading(false);
  }, [carbon, companyId, locationId]);

  const transferFromQuery = useCallback(async () => {
    if (!carbon || wizard.selectedToShelfIds.size === 0) {
      setAllTransferFromData([]);
      return;
    }

    setTransferFromIsLoading(true);

    // Get the selected "to" items to extract their itemIds
    const selectedToItems = allTransferToData.filter((item) =>
      wizard.selectedToShelfIds.has(item.shelfId!)
    );

    // Fetch data for each selected item
    const fromDataPromises = selectedToItems.map(async (toItem) => {
      const { data, error } = await carbon.rpc(
        "get_item_shelf_requirements_by_location_and_item",
        {
          company_id: companyId,
          location_id: locationId,
          item_id: toItem.itemId,
        }
      );

      if (error) {
        console.error(error);
        return [];
      }

      // Filter out the selected "to" shelf
      return (
        data
          ?.filter((item) => item.shelfId !== toItem.shelfId)
          .map((item) => ({
            itemId: item.itemId,
            itemReadableId: item.itemReadableId,
            description: item.description,
            thumbnailPath: item.thumbnailPath,
            quantityOnHand: item.quantityOnHandInShelf,
            quantityRequired: item.quantityRequiredByShelf,
            quantityAvailable:
              item.quantityOnHandInShelf - item.quantityRequiredByShelf,
            shelfId: item.shelfId,
            shelfName: item.shelfName,
          })) ?? []
      );
    });

    const fromDataArrays = await Promise.all(fromDataPromises);
    const flattenedFromData = fromDataArrays.flat();

    setAllTransferFromData(flattenedFromData);
    setTransferFromIsLoading(false);
  }, [
    carbon,
    companyId,
    locationId,
    wizard.selectedToShelfIds,
    allTransferToData,
  ]);

  useMount(() => {
    transferToQuery();
  });

  // Refresh "from" data when selected "to" items change
  useEffect(() => {
    transferFromQuery();
  }, [transferFromQuery]);

  // Reset offsets when page size changes
  useEffect(() => {
    setTransferToOffset(0);
    setTransferFromOffset(0);
  }, [pageSize]);

  // Deselect active item/shelf when "to" table page changes
  useEffect(() => {
    clearSelectedToShelves();
  }, [transferToOffset]);

  // Client-side filtering and pagination for "to" table
  useEffect(() => {
    let filtered = allTransferToData;

    if (transferToSearch) {
      filtered = filtered.filter((item) =>
        item.itemReadableId
          .toLowerCase()
          .includes(transferToSearch.toLowerCase())
      );
    }

    setTransferTo(filtered);
    setTransferToOffset(0); // Reset to first page when data changes
  }, [allTransferToData, transferToSearch]);

  // Client-side filtering and pagination for "from" table
  useEffect(() => {
    let filtered = allTransferFromData;

    if (transferFromSearch) {
      filtered = filtered.filter((item) =>
        item.itemReadableId
          .toLowerCase()
          .includes(transferFromSearch.toLowerCase())
      );
    }

    setTransferFrom(filtered);
    setTransferFromOffset(0); // Reset to first page when data changes
  }, [allTransferFromData, transferFromSearch]);

  // Pagination logic for "to" table
  const paginatedTransferTo = useMemo(
    () => transferTo.slice(transferToOffset, transferToOffset + pageSize),
    [transferTo, transferToOffset, pageSize]
  );

  const canPreviousPageTo = transferToOffset > 0;
  const canNextPageTo = transferToOffset + pageSize < transferTo.length;

  const handlePreviousPageTo = useCallback(() => {
    setTransferToOffset((prev) => Math.max(0, prev - pageSize));
  }, [pageSize]);

  const handleNextPageTo = useCallback(() => {
    setTransferToOffset((prev) => {
      const newOffset = prev + pageSize;
      return newOffset < transferTo.length ? newOffset : prev;
    });
  }, [pageSize, transferTo.length]);

  // Pagination logic for "from" table
  const paginatedTransferFrom = useMemo(
    () => transferFrom.slice(transferFromOffset, transferFromOffset + pageSize),
    [transferFrom, transferFromOffset, pageSize]
  );

  const canPreviousPageFrom = transferFromOffset > 0;
  const canNextPageFrom = transferFromOffset + pageSize < transferFrom.length;

  const handlePreviousPageFrom = useCallback(() => {
    setTransferFromOffset((prev) => Math.max(0, prev - pageSize));
  }, [pageSize]);

  const handleNextPageFrom = useCallback(() => {
    setTransferFromOffset((prev) => {
      const newOffset = prev + pageSize;
      return newOffset < transferFrom.length ? newOffset : prev;
    });
  }, [pageSize, transferFrom.length]);

  const columnsTo = useMemo<ColumnDef<TransferTableRow>[]>(() => {
    return [
      {
        accessorKey: "itemReadableId",
        cell: ({ row }) => (
          <HStack spacing={2}>
            <ItemThumbnail
              thumbnailPath={row.original.thumbnailPath}
              type="Part"
            />
            <VStack spacing={0} className="max-w-[200px] truncate">
              <div className="text-sm font-medium text-wrap">
                {row.original.itemReadableId}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.original.description}
              </div>
            </VStack>
          </HStack>
        ),
        header: "Item ID",
      },
      {
        accessorKey: "shelfName",
        cell: ({ row }) => row.original.shelfName,
        header: "Shelf",
      },
      {
        accessorKey: "quantityOnHand",
        cell: ({ row }) => {
          // Calculate total quantity being transferred to this shelf
          const transferLinesToThisShelf = wizard.lines.filter(
            (line) => line.toShelfId === row.original.shelfId
          );
          const totalTransferQuantity = transferLinesToThisShelf.reduce(
            (sum, line) => sum + (line.quantity ?? 0),
            0
          );

          const adjustedQuantity =
            row.original.quantityOnHand + totalTransferQuantity;

          return (
            <div className="flex flex-col">
              <span
                className={
                  totalTransferQuantity > 0
                    ? "text-muted-foreground line-through text-xs"
                    : ""
                }
              >
                {formatter.format(row.original.quantityOnHand)}
              </span>
              {totalTransferQuantity > 0 && (
                <span className="font-medium">
                  {formatter.format(adjustedQuantity)}
                </span>
              )}
            </div>
          );
        },
        header: "On Hand",
      },
      {
        accessorKey: "quantityRequired",
        cell: ({ row }) => formatter.format(row.original.quantityRequired),
        header: "Required",
      },
      {
        accessorKey: "quantityAvailable",
        cell: ({ row }) => {
          // Calculate total quantity being transferred to this shelf
          const transferLinesToThisShelf = wizard.lines.filter(
            (line) => line.toShelfId === row.original.shelfId
          );
          const totalTransferQuantity = transferLinesToThisShelf.reduce(
            (sum, line) => sum + (line.quantity ?? 0),
            0
          );

          const adjustedAvailable =
            row.original.quantityAvailable + totalTransferQuantity;

          return (
            <div className="flex flex-col">
              <span
                className={
                  totalTransferQuantity > 0
                    ? "text-muted-foreground line-through text-xs"
                    : ""
                }
              >
                {row.original.quantityAvailable < 0 ? (
                  <HStack>
                    <span className="text-red-500">
                      {formatter.format(row.original.quantityAvailable)}
                    </span>
                    <LuFlag className="text-red-500" />
                  </HStack>
                ) : (
                  <span>
                    {formatter.format(row.original.quantityAvailable)}
                  </span>
                )}
              </span>
              {totalTransferQuantity > 0 && (
                <span
                  className={`font-medium ${
                    adjustedAvailable < 0 ? "text-red-500" : ""
                  }`}
                >
                  {adjustedAvailable < 0 ? (
                    <HStack>
                      <span>{formatter.format(adjustedAvailable)}</span>
                      <LuFlag className="text-red-500" />
                    </HStack>
                  ) : (
                    formatter.format(adjustedAvailable)
                  )}
                </span>
              )}
            </div>
          );
        },
        header: "Available",
      },

      {
        id: "actions",
        cell: ({ row }) => {
          const isSelected = isToShelfSelected(row.original.shelfId!);
          const hasTransfers = hasTransferLinesToShelf(row.original.shelfId!);
          return (
            <div className="flex justify-end">
              <Button
                variant={isSelected ? "primary" : "secondary"}
                onClick={() => {
                  if (isSelected) {
                    // If already selected, deselect it
                    toggleToShelfSelection(row.original.shelfId!);
                  } else {
                    // If not selected, clear selection and select only this one
                    clearSelectedToShelves();
                    toggleToShelfSelection(row.original.shelfId!);
                  }
                }}
              >
                {hasTransfers ? (
                  <HStack>
                    <PulsingDot />
                    <span>Transfer</span>
                  </HStack>
                ) : (
                  "Transfer"
                )}
              </Button>
            </div>
          );
        },
        header: "",
      },
    ];
  }, [formatter, wizard.lines]);

  const columnsFrom = useMemo<ColumnDef<TransferTableRow>[]>(() => {
    return [
      {
        id: "actions",
        cell: ({ row }) => {
          // Find the corresponding "to" item
          const toItem = allTransferToData.find(
            (item) =>
              item.itemId === row.original.itemId &&
              wizard.selectedToShelfIds.has(item.shelfId!)
          );

          if (!toItem) return null;

          const isLineAdded = hasTransferLine(
            row.original.itemId,
            row.original.shelfId!,
            toItem.shelfId!
          );

          return (
            <div className="flex justify-end">
              <Button
                leftIcon={<LuArrowLeft />}
                variant={isLineAdded ? "primary" : "secondary"}
                onClick={() => {
                  if (isLineAdded) {
                    removeTransferLine(
                      row.original.itemId,
                      row.original.shelfId!,
                      toItem.shelfId!
                    );
                  } else {
                    // Calculate default quantity:
                    // Amount needed to bring "to" bin to 0 available (fulfill requirements)
                    // Capped by what's available in "from" bin
                    const quantityNeeded = Math.max(
                      0,
                      toItem.quantityRequired - toItem.quantityOnHand
                    );
                    const defaultQuantity = Math.min(
                      quantityNeeded,
                      row.original.quantityAvailable
                    );

                    addTransferLine({
                      itemId: row.original.itemId,
                      itemReadableId: row.original.itemReadableId,
                      description: row.original.description,
                      thumbnailPath: row.original.thumbnailPath,
                      fromShelfId: row.original.shelfId!,
                      fromShelfName: row.original.shelfName!,
                      toShelfId: toItem.shelfId!,
                      toShelfName: toItem.shelfName!,
                      quantityAvailable: row.original.quantityAvailable,
                      quantity: defaultQuantity,
                    });
                  }
                }}
              >
                Transfer
              </Button>
            </div>
          );
        },
        header: "",
      },
      {
        id: "quantity",
        cell: ({ row }) => {
          // Find the corresponding "to" item
          const toItem = allTransferToData.find(
            (item) =>
              item.itemId === row.original.itemId &&
              wizard.selectedToShelfIds.has(item.shelfId!)
          );

          if (!toItem) return null;

          const isLineAdded = hasTransferLine(
            row.original.itemId,
            row.original.shelfId!,
            toItem.shelfId!
          );

          if (!isLineAdded) return null;

          // Find the line to get the current quantity
          const line = wizard.lines.find(
            (l) =>
              l.itemId === row.original.itemId &&
              l.fromShelfId === row.original.shelfId! &&
              l.toShelfId === toItem.shelfId!
          );

          return (
            <NumberField
              value={Math.max(0, line?.quantity ?? 0)}
              minValue={0}
              onChange={(value: number) => {
                if (value !== null && !isNaN(value)) {
                  const clampedValue = Math.min(
                    Math.max(0, value),
                    row.original.quantityAvailable
                  );
                  updateTransferLineQuantity(
                    row.original.itemId,
                    row.original.shelfId!,
                    toItem.shelfId!,
                    clampedValue
                  );
                }
              }}
              className="w-24"
            >
              <NumberInputGroup>
                <NumberInput size="sm" />
              </NumberInputGroup>
            </NumberField>
          );
        },
        header: "Quantity",
      },
      {
        accessorKey: "itemReadableId",
        cell: ({ row }) => (
          <HStack spacing={2}>
            <ItemThumbnail
              thumbnailPath={row.original.thumbnailPath}
              type="Part"
            />
            <VStack spacing={0} className="max-w-[200px] truncate">
              <div className="text-sm font-medium text-wrap">
                {row.original.itemReadableId}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.original.description}
              </div>
            </VStack>
          </HStack>
        ),
        header: "Item ID",
      },
      {
        accessorKey: "shelfName",
        cell: ({ row }) => row.original.shelfName,
        header: "Shelf",
      },
      {
        accessorKey: "quantityOnHand",
        cell: ({ row }) => {
          // Find the corresponding "to" item
          const toItem = allTransferToData.find(
            (item) =>
              item.itemId === row.original.itemId &&
              wizard.selectedToShelfIds.has(item.shelfId!)
          );

          if (!toItem) return formatter.format(row.original.quantityOnHand);

          // Find the transfer line to get the quantity being transferred
          const transferLine = wizard.lines.find(
            (l) =>
              l.itemId === row.original.itemId &&
              l.fromShelfId === row.original.shelfId! &&
              l.toShelfId === toItem.shelfId!
          );

          const transferQuantity = transferLine?.quantity ?? 0;
          const adjustedQuantity =
            row.original.quantityOnHand - transferQuantity;

          return (
            <div className="flex flex-col">
              <span
                className={
                  transferQuantity > 0
                    ? "text-muted-foreground line-through text-xs"
                    : ""
                }
              >
                {formatter.format(row.original.quantityOnHand)}
              </span>
              {transferQuantity > 0 && (
                <span className="font-medium">
                  {formatter.format(adjustedQuantity)}
                </span>
              )}
            </div>
          );
        },
        header: "On Hand",
      },
      {
        accessorKey: "quantityAvailable",
        cell: ({ row }) => {
          // Find the corresponding "to" item
          const toItem = allTransferToData.find(
            (item) =>
              item.itemId === row.original.itemId &&
              wizard.selectedToShelfIds.has(item.shelfId!)
          );

          if (!toItem) {
            return row.original.quantityAvailable < 0 ? (
              <HStack>
                <span className="text-red-500">
                  {formatter.format(row.original.quantityAvailable)}
                </span>
                <LuFlag className="text-red-500" />
              </HStack>
            ) : (
              <span>{formatter.format(row.original.quantityAvailable)}</span>
            );
          }

          // Find the transfer line to get the quantity being transferred
          const transferLine = wizard.lines.find(
            (l) =>
              l.itemId === row.original.itemId &&
              l.fromShelfId === row.original.shelfId! &&
              l.toShelfId === toItem.shelfId!
          );

          const transferQuantity = transferLine?.quantity ?? 0;
          const adjustedAvailable =
            row.original.quantityAvailable - transferQuantity;

          return (
            <div className="flex flex-col">
              <span
                className={
                  transferQuantity > 0
                    ? "text-muted-foreground line-through text-xs"
                    : ""
                }
              >
                {row.original.quantityAvailable < 0 ? (
                  <HStack>
                    <span className="text-red-500">
                      {formatter.format(row.original.quantityAvailable)}
                    </span>
                    <LuFlag className="text-red-500" />
                  </HStack>
                ) : (
                  <span>
                    {formatter.format(row.original.quantityAvailable)}
                  </span>
                )}
              </span>
              {transferQuantity > 0 && (
                <span
                  className={`font-medium ${
                    adjustedAvailable < 0 ? "text-red-500" : ""
                  }`}
                >
                  {adjustedAvailable < 0 ? (
                    <HStack>
                      <span>{formatter.format(adjustedAvailable)}</span>
                      <LuFlag className="text-red-500" />
                    </HStack>
                  ) : (
                    formatter.format(adjustedAvailable)
                  )}
                </span>
              )}
            </div>
          );
        },
        header: "Available",
      },
      {
        accessorKey: "quantityRequired",
        cell: ({ row }) => formatter.format(row.original.quantityRequired),
        header: "Required",
      },
    ];
  }, [formatter, allTransferToData, wizard.selectedToShelfIds, wizard.lines]);

  return (
    <>
      <div className="grid grid-cols-2 gap-0 h-full w-full">
        <div className="flex flex-col">
          <div className="flex-1 border-r">
            <TransferTable
              title="Transfer To"
              data={paginatedTransferTo}
              isLoading={transferToIsLoading}
              columns={columnsTo}
              count={transferTo.length}
              offset={transferToOffset}
              canPreviousPage={canPreviousPageTo}
              canNextPage={canNextPageTo}
              handlePreviousPage={handlePreviousPageTo}
              handleNextPage={handleNextPageTo}
              pageSize={pageSize}
              setPageSize={setPageSize}
              search={transferToSearch}
              onSearchChange={setTransferToSearch}
              isRowSelected={(row) => isToShelfSelected(row.shelfId!)}
            />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex-1">
            <TransferTable
              title="Transfer From"
              data={paginatedTransferFrom}
              isLoading={transferFromIsLoading}
              columns={columnsFrom}
              count={transferFrom.length}
              offset={transferFromOffset}
              canPreviousPage={canPreviousPageFrom}
              canNextPage={canNextPageFrom}
              handlePreviousPage={handlePreviousPageFrom}
              handleNextPage={handleNextPageFrom}
              pageSize={pageSize}
              setPageSize={setPageSize}
              search={transferFromSearch}
              onSearchChange={setTransferFromSearch}
              isRowSelected={(row) => {
                const toItem = allTransferToData.find(
                  (item) =>
                    item.itemId === row.itemId &&
                    wizard.selectedToShelfIds.has(item.shelfId!)
                );
                return toItem
                  ? hasTransferLine(row.itemId, row.shelfId!, toItem.shelfId!)
                  : false;
              }}
            />
          </div>
        </div>
      </div>
      <StockTransferWizardWidget locationId={locationId} />
    </>
  );
}

function TransferTable({
  title,
  data,
  columns,
  count,
  isLoading,
  offset,
  pageSize,
  setPageSize,
  canPreviousPage,
  canNextPage,
  handlePreviousPage,
  handleNextPage,
  search,
  onSearchChange,
  isRowSelected,
}: {
  title: string;
  data: TransferTableRow[];
  isLoading: boolean;
  columns: ColumnDef<TransferTableRow>[];
  count: number;
  offset: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  isRowSelected?: (row: TransferTableRow) => boolean;
}) {
  const pageSizes = [20, 100, 500, 1000];
  if (!pageSizes.includes(pageSize)) {
    pageSizes.push(pageSize);
    pageSizes.sort();
  }

  const table = useReactTable({
    data: data,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const tableRef = useRef<HTMLTableElement>(null);

  return (
    <VStack spacing={0} className="h-full bg-card flex flex-col w-full px-0">
      <HStack className="px-4 py-2 justify-between bg-card border-b  w-full">
        <HStack spacing={4} className="w-full justify-between">
          <Heading size="h4" className="flex-shrink-0">
            {title}
          </Heading>
          <div>
            <InputGroup size="sm">
              <InputLeftElement>
                <LuSearch className="text-muted-foreground w-3.5 h-3.5 mt-[-2px]" />
              </InputLeftElement>
              <Input
                value={search}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                }}
                placeholder="Search"
                className="w-[100px] sm:w-[200px] text-sm"
              />
            </InputGroup>
          </div>
        </HStack>
      </HStack>
      <div
        id="table-container"
        className="w-full h-full overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent"
        style={{ contain: "strict" }}
      >
        <div className="flex max-w-full h-full">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Spinner className="size-8" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col w-full h-full items-center justify-center gap-4">
              <div className="flex justify-center items-center h-12 w-12 rounded-full bg-foreground text-background -mt-[10dvh]">
                <LuTriangleAlert className="h-6 w-6 flex-shrink-0" />
              </div>
              <span className="text-xs font-mono font-light text-foreground uppercase">
                No bins exist
              </span>
            </div>
          ) : (
            <TableBase
              ref={tableRef}
              full
              className="relative border-collapse border-spacing-0"
            >
              <Thead className="sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <Tr key={headerGroup.id} className="h-10">
                    {headerGroup.headers.map((header) => {
                      const accessorKey = getAccessorKey(
                        header.column.columnDef
                      );

                      const sortable =
                        accessorKey &&
                        !accessorKey.endsWith(".id") &&
                        header.column.columnDef.enableSorting !== false;

                      return (
                        <Th
                          key={header.id}
                          colSpan={header.colSpan}
                          id={`header-${header.id}`}
                          className={cn(
                            "px-4 py-3 whitespace-nowrap",
                            sortable && "cursor-pointer"
                          )}
                          style={{
                            width: header.getSize(),
                          }}
                        >
                          {!header.isPlaceholder && (
                            <div className="flex justify-start items-center gap-2">
                              {header.column.columnDef.meta?.icon}
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </div>
                          )}
                        </Th>
                      );
                    })}
                  </Tr>
                ))}
              </Thead>
              <Tbody>
                {rows.map((row) => {
                  const selected = isRowSelected?.(row.original) ?? false;
                  return (
                    <Tr
                      key={row.id}
                      className={cn(
                        "border-b border-border transition-colors",
                        selected && "bg-primary/10 hover:bg-primary/15"
                      )}
                    >
                      {row.getVisibleCells().map((cell, columnIndex) => {
                        return (
                          <Td
                            key={cell.id}
                            className="relative px-4 py-2 whitespace-nowrap text-sm outline-none"
                          >
                            <div>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </div>
                          </Td>
                        );
                      })}
                    </Tr>
                  );
                })}
              </Tbody>
            </TableBase>
          )}
        </div>
      </div>
      <hr className="m-0 h-px w-full border-none bg-gradient-to-r from-zinc-200/0 via-zinc-500/30 to-zinc-200/0" />
      <HStack
        className="text-center bg-card justify-between py-4 w-full z-[1] px-4"
        spacing={6}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">{pageSize} rows</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Results per page</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={`${pageSize}`}>
              {pageSizes.map((size) => (
                <DropdownMenuRadioItem
                  key={`${size}`}
                  value={`${size}`}
                  onClick={() => {
                    setPageSize(size);
                  }}
                >
                  {size}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <HStack>
          <PaginationButtons
            count={count}
            offset={offset}
            pageSize={pageSize}
            canPreviousPage={canPreviousPage}
            canNextPage={canNextPage}
            handlePreviousPage={handlePreviousPage}
            handleNextPage={handleNextPage}
          />
        </HStack>
      </HStack>
    </VStack>
  );
}

function PaginationButtons({
  count,
  offset,
  pageSize,
  canPreviousPage,
  canNextPage,
  handlePreviousPage,
  handleNextPage,
}: {
  count: number;
  offset: number;
  pageSize: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
}) {
  return (
    <>
      <div className="text-foreground text-sm font-medium align-center hidden lg:flex">
        {count > 0 ? offset + 1 : 0} - {Math.min(offset + pageSize, count)} of{" "}
        {count}
      </div>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="secondary"
            isDisabled={!canPreviousPage}
            onClick={handlePreviousPage}
            leftIcon={<BsChevronLeft />}
          >
            Previous
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <HStack>{prettifyKeyboardShortcut("ArrowLeft")}</HStack>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="secondary"
            isDisabled={!canNextPage}
            onClick={handleNextPage}
            rightIcon={<BsChevronRight />}
          >
            Next
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <HStack>{prettifyKeyboardShortcut("ArrowRight")}</HStack>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

const StockTransferWizardWidget = ({ locationId }: { locationId: string }) => {
  const fetcher = useFetcher<Result>();
  const [wizard] = useStockTransferWizard();
  const linesCount = useStockTransferWizardLinesCount();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Filter out lines with quantity 0
  const activeLines = wizard.lines.filter((line) => (line.quantity ?? 0) > 0);

  const onRemoveItem = (
    itemId: string,
    fromShelfId: string,
    toShelfId: string
  ) => {
    removeTransferLine(itemId, fromShelfId, toShelfId);
  };

  const onClearAll = () => {
    clearStockTransferWizard();
  };

  if (linesCount === 0) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="relative flex items-center justify-center w-16 h-16 bg-card border-2 border-border rounded-full shadow-2xl hover:scale-105 transition-transform duration-200"
        >
          <LuTruck className="w-6 h-6 text-foreground" />
          {activeLines.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-7 w-7 flex items-center justify-center p-0 border-2 border-background">
              {activeLines.length}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <div
        className={`bg-card border-2 border-border rounded-2xl shadow-2xl transition-all duration-300 ease-in-out ${
          isExpanded ? "w-96 h-[32rem]" : "w-80 h-auto"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <LuCheckCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground text-base">
                Transfer Lines
              </h3>
              <p className="text-xs text-muted-foreground">
                {activeLines.length}{" "}
                {activeLines.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              variant="ghost"
              aria-label={isExpanded ? "Minimize" : "Expand"}
              icon={
                isExpanded ? (
                  <LuMinus className="size-4" />
                ) : (
                  <LuMaximize2 className="size-4" />
                )
              }
              onClick={() => setIsExpanded(!isExpanded)}
            />
            <IconButton
              variant="ghost"
              aria-label="Close"
              icon={<LuX className="size-4" />}
              onClick={() => setIsMinimized(true)}
            />
          </div>
        </div>

        {/* Content */}
        {isExpanded ? (
          <div className="flex flex-col h-[calc(32rem-5rem)]">
            <ScrollArea className="flex-1 p-4">
              {activeLines.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <LuTruck className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No transfer lines yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start adding items to transfer
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLines.map((line) => (
                    <div
                      key={`${line.itemId}-${line.fromShelfId}-${line.toShelfId}`}
                      className="group bg-secondary/50 border border-border rounded-lg p-3 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ItemThumbnail
                              thumbnailPath={line.thumbnailPath}
                              type="Part"
                              size="sm"
                            />
                            <div className="flex-1">
                              <span className="font-mono text-xs font-semibold block">
                                {line.itemReadableId}
                              </span>
                              <p className="text-xs text-muted-foreground truncate">
                                {line.description}
                              </p>
                            </div>
                          </div>
                        </div>
                        <IconButton
                          variant="secondary"
                          aria-label="Remove item"
                          icon={<LuTrash2 />}
                          size="sm"
                          onClick={() =>
                            onRemoveItem(
                              line.itemId,
                              line.fromShelfId,
                              line.toShelfId
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <HStack
                          className="items-center justify-start"
                          spacing={1}
                        >
                          <Badge variant="outline">{line.fromShelfName}</Badge>
                          <LuArrowRight className="size-4" />
                          <Count count={line.quantity ?? 0} />
                          <LuArrowRight className="size-4" />
                          <Badge variant="outline">{line.toShelfName}</Badge>
                        </HStack>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {activeLines.length > 0 && (
              <div className="p-4 border-t-2 border-border space-y-2">
                <fetcher.Form method="post" action={path.to.newStockTransfer}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input
                    type="hidden"
                    name="lines"
                    value={JSON.stringify(activeLines)}
                  />
                  <Button
                    isLoading={fetcher.state !== "idle"}
                    isDisabled={fetcher.state !== "idle"}
                    size="lg"
                    className="w-full"
                    type="submit"
                  >
                    Create Transfer
                  </Button>
                </fetcher.Form>
                <Button variant="ghost" className="w-full" onClick={onClearAll}>
                  Clear All
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {activeLines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No transfer lines yet
              </p>
            ) : (
              <div className="space-y-2">
                {activeLines.slice(0, 3).map((line) => (
                  <div
                    key={`${line.itemId}-${line.fromShelfId}-${line.toShelfId}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-xs truncate flex-1">
                      {line.itemReadableId}
                    </span>
                    <HStack spacing={1}>
                      <Count count={line.quantity ?? 0} />
                      <LuArrowRight className="size-4" />
                      <Badge variant="outline" className="ml-2">
                        {line.toShelfName}
                      </Badge>
                    </HStack>
                  </div>
                ))}
                {activeLines.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{activeLines.length - 3} more
                  </p>
                )}
              </div>
            )}
            {activeLines.length > 0 && (
              <fetcher.Form method="post" action={path.to.newStockTransfer}>
                <input type="hidden" name="locationId" value={locationId} />
                <input
                  type="hidden"
                  name="lines"
                  value={JSON.stringify(activeLines)}
                />
                <Button
                  isLoading={fetcher.state !== "idle"}
                  isDisabled={fetcher.state !== "idle"}
                  size="lg"
                  className="w-full"
                  type="submit"
                >
                  Create Transfer
                </Button>
              </fetcher.Form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
