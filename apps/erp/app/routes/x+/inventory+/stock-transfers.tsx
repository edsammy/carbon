import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { VStack } from "@carbon/react";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { getStockTransfers } from "~/modules/inventory";
import StockTransfersTable from "~/modules/inventory/ui/StockTransfers/StockTransfersTable";
import { getLocationsList } from "~/modules/resources";
import { getUserDefaults } from "~/modules/users/users.server";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";
import { getGenericQueryFilters } from "~/utils/query";

export const handle: Handle = {
  breadcrumb: "Stock Transfers",
  to: path.to.stockTransfers,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId, userId } = await requirePermissions(request, {
    view: "inventory",
  });

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const search = searchParams.get("search");
  const { limit, offset, sorts, filters } =
    getGenericQueryFilters(searchParams);

  let locationId = searchParams.get("location");

  if (!locationId) {
    const userDefaults = await getUserDefaults(client, userId, companyId);
    if (userDefaults.error) {
      throw redirect(
        path.to.inventory,
        await flash(
          request,
          error(userDefaults.error, "Failed to load default location")
        )
      );
    }

    locationId = userDefaults.data?.locationId ?? null;
  }

  if (!locationId) {
    const locations = await getLocationsList(client, companyId);
    if (locations.error || !locations.data?.length) {
      throw redirect(
        path.to.inventory,
        await flash(
          request,
          error(locations.error, "Failed to load any locations")
        )
      );
    }
    locationId = locations.data?.[0].id as string;
  }

  const [stockTransfers] = await Promise.all([
    getStockTransfers(client, companyId, {
      locationId,
      search,
      limit,
      offset,
      sorts,
      filters,
    }),
  ]);

  if (stockTransfers.error) {
    console.error(stockTransfers.error);
    throw redirect(
      path.to.authenticatedRoot,
      await flash(request, error(null, "Error loading stock transfers"))
    );
  }

  return json({
    stockTransfers: stockTransfers.data ?? [],
    count: stockTransfers.count ?? 0,
    locationId,
  });
}

export default function StockTransfersRoute() {
  const { stockTransfers, count, locationId } = useLoaderData<typeof loader>();

  return (
    <VStack spacing={0} className="h-full">
      <StockTransfersTable
        data={stockTransfers}
        count={count ?? 0}
        locationId={locationId}
      />
      <Outlet />
    </VStack>
  );
}
