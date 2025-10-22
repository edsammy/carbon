import { Await, Outlet, useLoaderData, useParams } from "@remix-run/react";
import { ResizablePanels } from "~/components/Layout";
import { PartProperties } from "~/modules/items/ui/Parts";

import { requirePermissions } from "@carbon/auth/auth.server";
import { useRouteData } from "@carbon/remix";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { defer } from "@vercel/remix";
import { Suspense } from "react";
import type { ItemFile, PartSummary } from "~/modules/items";
import { getPartUsedIn } from "~/modules/items";
import type { UsedInNode } from "~/modules/items/ui/Item/UsedIn";
import { UsedInSkeleton, UsedInTree } from "~/modules/items/ui/Item/UsedIn";
import { path } from "~/utils/path";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "parts",
    bypassRls: true,
  });

  const { itemId } = params;
  if (!itemId) throw new Error("Could not find itemId");

  return defer({ usedIn: getPartUsedIn(client, itemId, companyId) });
}

export default function PartViewRoute() {
  const { itemId } = useParams();
  if (!itemId) throw new Error("Could not find itemId");

  const partData = useRouteData<{
    partSummary: PartSummary;
    files: Promise<ItemFile[]>;
  }>(path.to.part(itemId));

  if (!partData) throw new Error("Could not find part data");

  const { usedIn } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-[calc(100dvh-99px)] overflow-hidden w-full">
      <div className="flex flex-grow overflow-hidden">
        <ResizablePanels
          explorer={
            <Suspense fallback={<UsedInSkeleton />}>
              <Await resolve={usedIn}>
                {(resolvedUsedIn) => {
                  const {
                    issues,
                    jobMaterials,
                    jobs,
                    methodMaterials,
                    purchaseOrderLines,
                    receiptLines,
                    quoteLines,
                    quoteMaterials,
                    salesOrderLines,
                    shipmentLines,
                    supplierQuotes,
                  } = resolvedUsedIn;

                  const tree: UsedInNode[] = [
                    {
                      key: "issues",
                      name: "Issues",
                      module: "quality",
                      children: issues,
                    },
                    {
                      key: "jobs",
                      name: "Jobs",
                      module: "production",
                      children: jobs.map((job) => ({
                        ...job,
                        methodType: "Make",
                      })),
                    },
                    {
                      key: "jobMaterials",
                      name: "Job Materials",
                      module: "production",
                      children: jobMaterials,
                    },
                    {
                      key: "methodMaterials",
                      name: "Method Materials",
                      module: "parts",
                      // @ts-expect-error
                      children: methodMaterials,
                    },
                    {
                      key: "purchaseOrderLines",
                      name: "Purchase Orders",
                      module: "purchasing",
                      children: purchaseOrderLines.map((po) => ({
                        ...po,
                        methodType: "Buy",
                      })),
                    },
                    {
                      key: "receiptLines",
                      name: "Receipts",
                      module: "inventory",
                      children: receiptLines.map((receipt) => ({
                        ...receipt,
                        methodType: "Pick",
                      })),
                    },
                    {
                      key: "quoteLines",
                      name: "Quotes",
                      module: "sales",
                      children: quoteLines,
                    },
                    {
                      key: "quoteMaterials",
                      name: "Quote Materials",
                      module: "sales",
                      children: quoteMaterials?.map((qm) => ({
                        ...qm,
                        documentReadableId: qm.documentReadableId ?? "",
                      })),
                    },
                    {
                      key: "salesOrderLines",
                      name: "Sales Orders",
                      module: "sales",
                      children: salesOrderLines,
                    },
                    {
                      key: "shipmentLines",
                      name: "Shipments",
                      module: "inventory",
                      children: shipmentLines.map((shipment) => ({
                        ...shipment,
                        methodType: "Shipment",
                      })),
                    },
                    {
                      key: "supplierQuotes",
                      name: "Supplier Quotes",
                      module: "purchasing",
                      children: supplierQuotes,
                    },
                  ];

                  return (
                    <UsedInTree
                      tree={tree}
                      revisions={partData.partSummary?.revisions}
                      itemReadableId={partData.partSummary?.readableId ?? ""}
                      itemReadableIdWithRevision={
                        partData.partSummary?.readableIdWithRevision ?? ""
                      }
                    />
                  );
                }}
              </Await>
            </Suspense>
          }
          content={
            <div className="h-[calc(100dvh-99px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent w-full">
              <Outlet />
            </div>
          }
          properties={<PartProperties />}
        />
      </div>
    </div>
  );
}
