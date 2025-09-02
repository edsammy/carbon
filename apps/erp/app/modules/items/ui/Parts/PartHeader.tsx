import {
  Copy,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  Heading,
  IconButton,
  VStack,
  useDisclosure,
} from "@carbon/react";

import { Link, useParams } from "@remix-run/react";
import { LuEllipsisVertical, LuTrash } from "react-icons/lu";
import { DetailsTopbar } from "~/components/Layout";
import ConfirmDelete from "~/components/Modals/ConfirmDelete";
import { usePermissions, useRouteData } from "~/hooks";
import { path } from "~/utils/path";
import type { PartSummary } from "../../types";
import { usePartNavigation } from "./usePartNavigation";

const PartHeader = () => {
  const links = usePartNavigation();
  const { itemId } = useParams();
  if (!itemId) throw new Error("itemId not found");

  const permissions = usePermissions();
  const deleteModal = useDisclosure();

  const routeData = useRouteData<{ partSummary: PartSummary }>(
    path.to.part(itemId)
  );

  return (
    <div className="flex flex-shrink-0 items-center justify-between px-4 py-2 bg-card border-b border-border h-[50px] overflow-x-auto scrollbar-hide dark:border-none dark:shadow-[inset_0_0_1px_rgb(255_255_255_/_0.24),_0_0_0_0.5px_rgb(0,0,0,1),0px_0px_4px_rgba(0,_0,_0,_0.08)]">
      <VStack spacing={0} className="flex-grow">
        <HStack>
          <Link to={path.to.partDetails(itemId)}>
            <Heading size="h4" className="flex items-center gap-2">
              {/* <ModuleIcon icon={<MethodItemTypeIcon type="Part" />} /> */}
              <span>{routeData?.partSummary?.readableIdWithRevision}</span>
            </Heading>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                aria-label="More options"
                icon={<LuEllipsisVertical />}
                variant="ghost"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                disabled={
                  !permissions.can("delete", "parts") ||
                  !permissions.is("employee")
                }
                destructive
                onClick={deleteModal.onOpen}
              >
                <DropdownMenuIcon icon={<LuTrash />} />
                Delete Part
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Copy text={routeData?.partSummary?.readableIdWithRevision ?? ""} />
        </HStack>
      </VStack>
      <VStack spacing={0} className="flex-shrink justify-center items-end">
        <DetailsTopbar links={links} />
      </VStack>
      {deleteModal.isOpen && (
        <ConfirmDelete
          action={path.to.deleteItem(itemId)}
          isOpen={deleteModal.isOpen}
          name={routeData?.partSummary?.readableIdWithRevision ?? "part"}
          text={`Are you sure you want to delete ${routeData?.partSummary?.readableIdWithRevision}? This cannot be undone.`}
          onCancel={() => {
            deleteModal.onClose();
          }}
          onSubmit={() => {
            deleteModal.onClose();
          }}
        />
      )}
    </div>
  );
};

export default PartHeader;
