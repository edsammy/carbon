import {
  Badge,
  BadgeCloseButton,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  HStack,
  MenuIcon,
  MenuItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
  useDisclosure,
} from "@carbon/react";
import { convertKbToString, filterEmpty, formatDate } from "@carbon/utils";
import { Link, useRevalidator } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { IoMdAdd } from "react-icons/io";
import {
  LuBookMarked,
  LuCircleX,
  LuDownload,
  LuExternalLink,
  LuFileText,
  LuPencil,
  LuPin,
  LuRuler,
  LuTag,
  LuTrash,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import { RxCheck } from "react-icons/rx";
import { EmployeeAvatar, Hyperlink, Table } from "~/components";
import DocumentIcon from "~/components/DocumentIcon";
import { Enumerable } from "~/components/Enumerable";
import { Confirm, ConfirmDelete } from "~/components/Modals";
import { usePermissions, useUrlParams } from "~/hooks";
import { documentTypes } from "~/modules/shared";
import { usePeople } from "~/stores";
import { path } from "~/utils/path";
import { documentSourceTypes } from "../../documents.models";
import type { Document, DocumentLabel } from "../../types";
import DocumentCreateForm from "./DocumentCreateForm";
import { useDocument } from "./useDocument";

type DocumentsTableProps = {
  data: Document[];
  count: number;
  labels: DocumentLabel[];
  extensions: (string | null)[];
};

const DocumentsTable = memo(
  ({ data, count, labels, extensions }: DocumentsTableProps) => {
    const permissions = usePermissions();
    const revalidator = useRevalidator();
    const [params] = useUrlParams();
    const filter = params.get("q");

    // put rows in state for use with optimistic ui updates
    const [rows, setRows] = useState<Document[]>(data);
    // we have to do this useEffect silliness since we're putitng rows
    // in state for optimistic ui updates
    useEffect(() => {
      setRows(data);
    }, [data]);

    const {
      canUpdate,
      canDelete,
      deleteLabel,
      download,
      edit,
      view,
      favorite,
      label,
      setLabel,
    } = useDocument();

    const [people] = usePeople();
    const moveDocumentModal = useDisclosure();
    const deleteDocumentModal = useDisclosure();

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(
      null
    );

    const labelOptions = useMemo(
      () =>
        labels.map(({ label }) => ({
          value: label as string,
          label: label as string,
        })) ?? [],
      [labels]
    );

    const onDeleteLabel = useCallback(
      async (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
        row: Document,
        label: string
      ) => {
        e.stopPropagation();
        // optimistically update the UI and then make the mutation
        setRows((prev) => {
          const index = prev.findIndex((item) => item.id === row.id);
          const updated = [...prev];
          const labelIndex = updated[index].labels?.findIndex(
            (item: string) => item === label
          );
          if (labelIndex) {
            updated[index].labels?.splice(labelIndex, 1);
          }
          return updated;
        });
        // mutate the database
        await deleteLabel(row, label);
      },
      [deleteLabel]
    );

    const onLabel = useCallback(
      async (row: Document, labels: string[]) => {
        // optimistically update the UI and then make the mutation
        setRows((prev) => {
          const index = prev.findIndex((item) => item.id === row.id);
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            labels: labels.sort(),
          };
          return updated;
        });
        // mutate the database
        await label(row, labels);
      },
      [label]
    );

    // TODO: rows shouldn't be in state -- we should use optimistic updates like purchase order favorites
    const onFavorite = useCallback(
      async (row: Document) => {
        // optimistically update the UI and then make the mutation
        setRows((prev) => {
          const index = prev.findIndex((item) => item.id === row.id);
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            favorite: !updated[index].favorite,
          };
          return filter === "starred"
            ? updated.filter((item) => item.favorite === true)
            : updated;
        });
        // mutate the database
        await favorite(row);
      },
      [favorite, filter]
    );

    const columns = useMemo<ColumnDef<Document>[]>(() => {
      return [
        {
          accessorKey: "name",
          header: "Name",
          cell: ({ row }) => (
            <HStack>
              {row.original.favorite ? (
                <LuPin
                  className="cursor-pointer w-4 h-4 outline-foreground fill-foreground flex-shrink-0"
                  onClick={() => onFavorite(row.original)}
                />
              ) : (
                <LuPin
                  className="cursor-pointer w-4 h-4 text-muted-foreground flex-shrink-0"
                  onClick={() => onFavorite(row.original)}
                />
              )}
              <DocumentIcon
                className="flex-shrink-0"
                type={row.original.type!}
              />
              <Hyperlink
                onClick={() => view(row.original)}
                className="max-w-[260px] truncate"
              >
                <>{row.original.name}</>
              </Hyperlink>
            </HStack>
          ),
          meta: {
            icon: <LuBookMarked />,
          },
        },
        {
          accessorKey: "sourceDocument",
          header: "Source Document",
          cell: ({ row }) =>
            row.original.sourceDocument &&
            row.original.sourceDocumentId && (
              <Link
                to={getDocumentLocation(
                  row.original
                    .sourceDocument as (typeof documentSourceTypes)[number],
                  row.original.sourceDocumentId
                )}
                prefetch="intent"
                className="group flex items-center gap-1"
              >
                <Enumerable value={row.original.sourceDocument} />{" "}
                <span className="group-hover:opacity-100 opacity-0 transition-opacity duration-200 w-4 h-4 text-foreground">
                  <LuExternalLink />
                </span>
              </Link>
            ),
          meta: {
            icon: <LuFileText />,
            filter: {
              type: "static",
              options: documentSourceTypes?.map((type) => ({
                value: type,
                label: <Enumerable value={type} />,
              })),
            },
          },
        },
        {
          id: "labels",
          header: "Labels",
          cell: ({ row }) => (
            <HStack spacing={1}>
              {row.original.labels?.map((label: string) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setLabel(label)}
                >
                  {label}
                  <BadgeCloseButton
                    onClick={(e) => onDeleteLabel(e, row.original, label)}
                  />
                </Badge>
              ))}
              <Popover>
                <PopoverTrigger>
                  <Badge variant="secondary" className="cursor-pointer px-1">
                    <IoMdAdd />
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  {/* TODO: we should have a CreateableMultiSelect component for this */}

                  <CreatableCommand
                    options={labelOptions}
                    selected={row.original.labels ?? []}
                    onChange={(newValue) =>
                      onLabel(row.original, [
                        ...(row.original.labels ?? []),
                        newValue,
                      ])
                    }
                    onCreateOption={async (newValue) => {
                      await onLabel(row.original, [
                        ...(row.original.labels ?? []),
                        newValue,
                      ]);
                      revalidator.revalidate();
                    }}
                  />
                </PopoverContent>
              </Popover>
            </HStack>
          ),
          meta: {
            icon: <LuTag />,
            filter: {
              type: "static",
              options: labelOptions,
              isArray: true,
            },
          },
        },
        {
          accessorKey: "size",
          header: "Size",
          cell: ({ row }) => convertKbToString(row.original.size ?? 0),
          meta: {
            icon: <LuRuler />,
          },
        },
        {
          accessorKey: "type",
          header: "Type",
          cell: (item) => <Enumerable value={item.getValue<string>()} />,
          meta: {
            icon: <LuFileText />,
            filter: {
              type: "static",
              options: documentTypes.map((type) => ({
                label: (
                  <HStack spacing={2}>
                    <DocumentIcon type={type} />
                    <span>{type}</span>
                  </HStack>
                ),
                value: type,
              })),
            },
          },
        },
        {
          accessorKey: "extension",
          header: "File Extension",
          cell: (item) => item.getValue(),
          meta: {
            icon: <LuFileText />,
            filter: {
              type: "static",
              options: filterEmpty(extensions).map((extension) => ({
                label: extension,
                value: extension,
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
      // Don't put the revalidator in the deps array
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      extensions,
      labelOptions,
      onDeleteLabel,
      onFavorite,
      onLabel,
      people,
      setLabel,
      view,
    ]);

    const defaultColumnVisibility = {
      type: false,
      extension: false,
      createdAt: false,
      updatedAt: false,
      updatedBy: false,
      description: false,
    };

    const renderContextMenu = useMemo(() => {
      // eslint-disable-next-line react/display-name
      return (row: Document) => (
        <>
          <MenuItem disabled={canUpdate(row)} onClick={() => edit(row)}>
            <MenuIcon icon={<LuPencil />} />
            Edit
          </MenuItem>
          <MenuItem onClick={() => download(row)}>
            <MenuIcon icon={<LuDownload />} />
            Download
          </MenuItem>
          <MenuItem
            onClick={() => {
              onFavorite(row);
            }}
          >
            <MenuIcon icon={<LuPin />} />
            Favorite
          </MenuItem>
          <MenuItem
            disabled={canDelete(row)}
            onClick={() => {
              setSelectedDocument(row);
              moveDocumentModal.onOpen();
            }}
          >
            <MenuIcon icon={<LuTrash />} />
            {filter !== "trash" ? "Move to Trash" : "Restore from Trash"}
          </MenuItem>
          <MenuItem
            disabled={canDelete(row)}
            destructive
            onClick={() => {
              setSelectedDocument(row);
              deleteDocumentModal.onOpen();
            }}
          >
            <MenuIcon icon={<LuCircleX />} />
            Permanently Delete
          </MenuItem>
        </>
      );
    }, [
      canUpdate,
      canDelete,
      filter,
      edit,
      download,
      onFavorite,
      moveDocumentModal,
      deleteDocumentModal,
    ]);

    return (
      <>
        <Table<Document>
          count={count}
          columns={columns}
          data={rows}
          defaultColumnVisibility={defaultColumnVisibility}
          primaryAction={
            permissions.can("create", "documents") && <DocumentCreateForm />
          }
          renderContextMenu={renderContextMenu}
          title="Documents"
        />

        {selectedDocument && selectedDocument.id && (
          <>
            {moveDocumentModal.isOpen && filter !== "trash" && (
              <ConfirmDelete
                action={path.to.deleteDocument(selectedDocument.id)}
                isOpen
                name={selectedDocument.name ?? ""}
                text={`Are you sure you want to move ${selectedDocument.name} to the trash?`}
                onCancel={() => {
                  moveDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
                onSubmit={() => {
                  moveDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
              />
            )}

            {moveDocumentModal.isOpen && filter === "trash" && (
              <Confirm
                action={path.to.documentRestore(selectedDocument.id)}
                isOpen
                title={`Restore ${selectedDocument.name}`}
                text={`Are you sure you want to restore ${selectedDocument.name} from the trash?`}
                confirmText="Restore"
                onCancel={() => {
                  moveDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
                onSubmit={() => {
                  moveDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
              />
            )}

            {deleteDocumentModal.isOpen && (
              <ConfirmDelete
                action={path.to.deleteDocumentPermanently(selectedDocument.id)}
                isOpen
                name={selectedDocument.name ?? ""}
                text={`Are you sure you want to delete ${selectedDocument.name} permanently? This cannot be undone.`}
                onCancel={() => {
                  deleteDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
                onSubmit={() => {
                  deleteDocumentModal.onClose();
                  setSelectedDocument(null);
                }}
              />
            )}
          </>
        )}
      </>
    );
  }
);

type CreatableCommandProps = {
  options: {
    label: string;
    value: string;
  }[];
  selected: string[];
  onChange: (selected: string) => void;
  onCreateOption: (inputValue: string) => void;
};

const CreatableCommand = ({
  options,
  selected,
  onChange,
  onCreateOption,
}: CreatableCommandProps) => {
  const [search, setSearch] = useState("");
  const isExactMatch = options.some(
    (option) => option.value.toLowerCase() === search.toLowerCase()
  );

  return (
    <Command>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search..."
        className="h-9"
      />
      <CommandGroup>
        {options.map((option) => {
          const isSelected = !!selected?.includes(option.value);
          return (
            <CommandItem
              value={option.label}
              key={option.value}
              onSelect={() => {
                if (!isSelected) onChange(option.value);
              }}
            >
              {option.label}
              <RxCheck
                className={cn(
                  "ml-auto h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </CommandItem>
          );
        })}
        {!isExactMatch && !!search && (
          <CommandItem
            onSelect={() => {
              onCreateOption(search);
            }}
            value={search}
          >
            <span>Create</span>
            <span className="ml-1 font-bold">{search}</span>
          </CommandItem>
        )}
      </CommandGroup>
    </Command>
  );
};

DocumentsTable.displayName = "DocumentsTable";

export default DocumentsTable;

function getDocumentLocation(
  sourceDocument: (typeof documentSourceTypes)[number],
  sourceDocumentId: string
) {
  switch (sourceDocument) {
    case "Part":
      return path.to.part(sourceDocumentId);
    case "Material":
      return path.to.material(sourceDocumentId);
    case "Tool":
      return path.to.tool(sourceDocumentId);
    case "Consumable":
      return path.to.consumable(sourceDocumentId);
    case "Gauge Calibration Record":
      return path.to.gaugeCalibrationRecord(sourceDocumentId);
    case "Job":
      return path.to.job(sourceDocumentId);
    // case "Service":
    //   return path.to.service(sourceDocumentId);
    case "Purchase Order":
      return path.to.purchaseOrder(sourceDocumentId);
    case "Purchase Invoice":
      return path.to.purchaseInvoice(sourceDocumentId);
    case "Quote":
      return path.to.quote(sourceDocumentId);
    case "Request for Quote":
      return path.to.salesRfq(sourceDocumentId);
    case "Sales Order":
      return path.to.salesOrder(sourceDocumentId);
    case "Sales Invoice":
      return path.to.salesInvoice(sourceDocumentId);
    case "Supplier Quote":
      return path.to.supplierQuote(sourceDocumentId);
    default:
      return "#";
  }
}
