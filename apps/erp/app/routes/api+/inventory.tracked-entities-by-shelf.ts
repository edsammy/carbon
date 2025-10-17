import { requirePermissions } from "@carbon/auth/auth.server";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getItemShelfQuantities } from "~/modules/items/items.service";

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {});

  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const shelfId = url.searchParams.get("shelfId");
  const locationId = url.searchParams.get("locationId");

  if (!itemId || !locationId) {
    return json({
      data: [],
      error: null,
    });
  }

  // Get all tracked entities for the item in the location
  const result = await getItemShelfQuantities(
    client,
    itemId,
    companyId,
    locationId
  );

  if (result.error) {
    return json({
      data: [],
      error: result.error,
    });
  }

  // Filter to only include entities from the specific shelf
  const shelfEntities =
    result.data?.filter(
      (entity) => entity.shelfId === shelfId && entity.trackedEntityId
    ) || [];

  return json({
    data: shelfEntities,
    error: null,
  });
}
