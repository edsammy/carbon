import { PaperlessPartsClient } from "./client";

export {
  createPartFromComponent,
  findPartByExternalId,
  getCarbonOrderStatus,
  getCustomerIdAndContactId,
  getCustomerLocationIds,
  getEmployeeAndSalesPersonId,
  getOrCreatePart,
  getOrderLocationId,
  insertOrderLines,
} from "./lib";
export { OrderSchema } from "./schemas";

export async function getPaperlessParts(apiKey: string) {
  const client = new PaperlessPartsClient(apiKey);
  return client;
}
