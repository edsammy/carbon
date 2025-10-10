import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { VStack } from "@carbon/react";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { getPickLists } from "~/modules/inventory";
import PickListsTable from "~/modules/inventory/ui/PickLists/PickListsTable";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";
import { getGenericQueryFilters } from "~/utils/query";

export const handle: Handle = {
  breadcrumb: "Pick Lists",
  to: path.to.pickLists,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "inventory",
  });

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const search = searchParams.get("search");
  const { limit, offset, sorts, filters } =
    getGenericQueryFilters(searchParams);

  const [pickLists] = await Promise.all([
    getPickLists(client, companyId, {
      search,
      limit,
      offset,
      sorts,
      filters,
    }),
  ]);

  if (pickLists.error) {
    throw redirect(
      path.to.authenticatedRoot,
      await flash(request, error(null, "Error loading pickLists"))
    );
  }

  return json({
    pickLists: pickLists.data ?? [],
    count: pickLists.count ?? 0,
  });
}

export default function PickListsRoute() {
  const { pickLists, count } = useLoaderData<typeof loader>();

  return (
    <VStack spacing={0} className="h-full">
      <PickListsTable data={pickLists} count={count ?? 0} />
      <Outlet />
    </VStack>
  );
}
