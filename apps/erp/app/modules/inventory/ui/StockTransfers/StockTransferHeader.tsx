import {
  Button,
  Copy,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  Heading,
  IconButton,
  useDisclosure,
} from "@carbon/react";
import { useFetcher, useParams } from "@remix-run/react";
import {
  LuBarcode,
  LuCircleCheck,
  LuCirclePlay,
  LuEllipsisVertical,
  LuLoaderCircle,
  LuTrash,
} from "react-icons/lu";
import ConfirmDelete from "~/components/Modals/ConfirmDelete";
import { usePermissions, useRouteData } from "~/hooks";
import type {
  ItemTracking,
  StockTransfer,
  StockTransferLine,
} from "~/modules/inventory";

import type { Result } from "@carbon/auth";
import Assignee, { useOptimisticAssignment } from "~/components/Assignee";
import { path } from "~/utils/path";
import StockTransferCompleteModal from "./StockTransferCompleteModal";
import StockTransferStatus from "./StockTransferStatus";

const StockTransferHeader = () => {
  const { id } = useParams();
  if (!id) throw new Error("id not found");

  const routeData = useRouteData<{
    stockTransfer: StockTransfer;
    stockTransferLines: StockTransferLine[];
    stockTransferLineTracking: ItemTracking[];
  }>(path.to.stockTransfer(id));

  if (!routeData?.stockTransfer)
    throw new Error("Failed to load stockTransfer");
  const status = routeData.stockTransfer.status;

  const permissions = usePermissions();
  const postModal = useDisclosure();
  const deleteModal = useDisclosure();
  const statusFetcher = useFetcher<Result>();

  const canComplete =
    routeData.stockTransferLines.length > 0 &&
    routeData.stockTransferLines.some(
      (line) => (line.pickedQuantity ?? 0) !== 0
    );

  const isCompleted = status === "Completed";

  const optimisticAssignment = useOptimisticAssignment({
    id,
    table: "stockTransfer",
  });
  const assignee =
    optimisticAssignment !== undefined
      ? optimisticAssignment
      : routeData?.stockTransfer?.assignee;

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-2 bg-card border-b border-border h-[50px] overflow-x-auto scrollbar-hide dark:border-none dark:shadow-[inset_0_0_1px_rgb(255_255_255_/_0.24),_0_0_0_0.5px_rgb(0,0,0,1)]">
        <HStack className="w-full justify-between">
          <HStack>
            <Heading size="h4" className="flex items-center gap-2">
              <span>{routeData?.stockTransfer?.stockTransferId}</span>
            </Heading>

            <Copy text={routeData?.stockTransfer?.stockTransferId ?? ""} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  aria-label="More options"
                  icon={<LuEllipsisVertical />}
                  variant="secondary"
                  size="sm"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  disabled={
                    !permissions.can("delete", "inventory") ||
                    !permissions.is("employee")
                  }
                  destructive
                  onClick={deleteModal.onOpen}
                >
                  <DropdownMenuIcon icon={<LuTrash />} />
                  Delete Stock Transfer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <StockTransferStatus status={routeData?.stockTransfer?.status} />
          </HStack>
          <HStack>
            <Assignee
              size="md"
              id={id}
              value={assignee ?? ""}
              table="stockTransfer"
              isReadOnly={!permissions.can("update", "inventory")}
            />
            <Button variant="secondary" leftIcon={<LuBarcode />} asChild>
              <a
                target="_blank"
                href={path.to.file.stockTransfer(id)}
                rel="noreferrer"
              >
                Pick List
              </a>
            </Button>
            <statusFetcher.Form
              method="post"
              action={path.to.stockTransferStatus(id)}
            >
              <input type="hidden" name="status" value="Released" />
              <Button
                type="submit"
                leftIcon={<LuCirclePlay />}
                variant={status === "Draft" ? "primary" : "secondary"}
                isDisabled={
                  status !== "Draft" ||
                  statusFetcher.state !== "idle" ||
                  !permissions.can("update", "inventory")
                }
                isLoading={
                  statusFetcher.state !== "idle" &&
                  statusFetcher.formData?.get("status") === "Released"
                }
              >
                Release
              </Button>
            </statusFetcher.Form>
            <Button
              variant={canComplete && !isCompleted ? "primary" : "secondary"}
              onClick={postModal.onOpen}
              isDisabled={
                !canComplete || isCompleted || !permissions.is("employee")
              }
              leftIcon={<LuCircleCheck />}
            >
              Complete
            </Button>
            <statusFetcher.Form
              method="post"
              action={path.to.stockTransferStatus(id)}
            >
              <input type="hidden" name="status" value="Draft" />
              <Button
                type="submit"
                variant="secondary"
                leftIcon={<LuLoaderCircle />}
                isDisabled={
                  ["Draft"].includes(routeData?.stockTransfer?.status ?? "") ||
                  statusFetcher.state !== "idle" ||
                  !permissions.can("update", "purchasing")
                }
                isLoading={
                  statusFetcher.state !== "idle" &&
                  statusFetcher.formData?.get("status") === "Draft"
                }
              >
                Reopen
              </Button>
            </statusFetcher.Form>
          </HStack>
        </HStack>
      </div>

      {postModal.isOpen && (
        <StockTransferCompleteModal onClose={postModal.onClose} />
      )}
      {deleteModal.isOpen && (
        <ConfirmDelete
          action={path.to.deleteStockTransfer(id)}
          isOpen={deleteModal.isOpen}
          name={routeData?.stockTransfer?.id ?? "stockTransfer"}
          text={`Are you sure you want to delete ${routeData?.stockTransfer?.id}? This cannot be undone.`}
          onCancel={() => {
            deleteModal.onClose();
          }}
          onSubmit={() => {
            deleteModal.onClose();
          }}
        />
      )}
    </>
  );
};

export default StockTransferHeader;
