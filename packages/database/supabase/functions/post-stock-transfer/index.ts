import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { format } from "https://deno.land/std@0.205.0/datetime/mod.ts";
import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/nanoid.ts";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";
import { DB, getConnectionPool, getDatabaseClient } from "../lib/database.ts";
import { corsHeaders } from "../lib/headers.ts";
import type { Database } from "../lib/types.ts";

const pool = getConnectionPool(1);
const db = getDatabaseClient<DB>(pool);

const payloadValidator = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inventory"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    quantity: z.number().positive(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
  z.object({
    type: z.literal("unpickInventory"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
  z.object({
    type: z.literal("serial"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    trackedEntityId: z.string(),
    fromShelfId: z.string().nullable(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
  z.object({
    type: z.literal("batch"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    trackedEntityId: z.string(),
    fromShelfId: z.string().nullable(),
    quantity: z.number().positive(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
  z.object({
    type: z.literal("unpickSerial"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    trackedEntityId: z.string(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
  z.object({
    type: z.literal("unpickBatch"),
    stockTransferId: z.string(),
    stockTransferLineId: z.string(),
    trackedEntityId: z.string(),
    locationId: z.string(),
    userId: z.string(),
    companyId: z.string(),
  }),
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await req.json();
  const today = format(new Date(), "yyyy-MM-dd");

  try {
    const validatedPayload = payloadValidator.parse(payload);

    console.log({
      function: "post-stock-transfer",
      ...validatedPayload,
    });

    switch (validatedPayload.type) {
      case "inventory": {
        const {
          stockTransferId,
          stockTransferLineId,
          quantity,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
            [];

          // Create item ledger entries for inventory transfer
          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: -quantity,
            locationId: locationId,
            shelfId: stockTransferLine.fromShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            createdBy: userId,
            companyId,
          });

          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: quantity,
            locationId: locationId,
            shelfId: stockTransferLine.toShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            createdBy: userId,
            companyId,
          });

          // Insert item ledger entries
          if (itemLedgerInserts.length > 0) {
            await trx
              .insertInto("itemLedger")
              .values(itemLedgerInserts)
              .execute();
          }

          // Update stock transfer line with picked quantity
          await trx
            .updateTable("stockTransferLine")
            .set({
              pickedQuantity:
                (stockTransferLine.pickedQuantity ?? 0) + quantity,
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }

      case "unpickInventory": {
        const {
          stockTransferId,
          stockTransferLineId,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          const currentPickedQuantity = stockTransferLine.pickedQuantity ?? 0;

          if (currentPickedQuantity > 0) {
            const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
              [];

            // Create reverse item ledger entries to undo the transfer
            itemLedgerInserts.push({
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: currentPickedQuantity, // Positive to restore inventory at from shelf
              locationId: locationId,
              shelfId: stockTransferLine.fromShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              createdBy: userId,
              companyId,
            });

            itemLedgerInserts.push({
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: -currentPickedQuantity, // Negative to remove inventory from to shelf
              locationId: locationId,
              shelfId: stockTransferLine.toShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              createdBy: userId,
              companyId,
            });

            // Insert reverse item ledger entries
            if (itemLedgerInserts.length > 0) {
              await trx
                .insertInto("itemLedger")
                .values(itemLedgerInserts)
                .execute();
            }
          }

          // Reset picked quantity to 0
          await trx
            .updateTable("stockTransferLine")
            .set({
              trackedEntityId: null,
              pickedQuantity: 0,
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }

      case "serial": {
        const {
          fromShelfId,
          stockTransferId,
          stockTransferLineId,
          trackedEntityId,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
            [];

          // Create transfer activity
          const transferActivityId = nanoid();
          await trx
            .insertInto("trackedActivity")
            .values({
              id: transferActivityId,
              type: "Transfer",
              sourceDocument: "Stock Transfer",
              sourceDocumentId: stockTransferId,
              attributes: {
                "Stock Transfer": stockTransferId,
                "Stock Transfer Line": stockTransferLineId,
                "From Location": locationId,
                "To Location": locationId,
                "From Shelf": stockTransferLine.fromShelfId,
                "To Shelf": stockTransferLine.toShelfId,
              },
              companyId,
              createdBy: userId,
            })
            .execute();

          // Record tracked entity as input to transfer
          await trx
            .insertInto("trackedActivityInput")
            .values({
              trackedActivityId: transferActivityId,
              trackedEntityId: trackedEntityId,
              quantity: 1,
              companyId,
              createdBy: userId,
            })
            .execute();

          // Create item ledger entries for transfer
          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: -1,
            locationId: locationId,
            shelfId: fromShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            trackedEntityId: trackedEntityId,
            createdBy: userId,
            companyId,
          });

          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: 1,
            locationId: locationId,
            shelfId: stockTransferLine.toShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            trackedEntityId: trackedEntityId,
            createdBy: userId,
            companyId,
          });

          // Insert item ledger entries
          if (itemLedgerInserts.length > 0) {
            await trx
              .insertInto("itemLedger")
              .values(itemLedgerInserts)
              .execute();
          }

          // Update stock transfer line with picked quantity
          await trx
            .updateTable("stockTransferLine")
            .set({
              trackedEntityId,
              fromShelfId: fromShelfId,
              pickedQuantity: (stockTransferLine.pickedQuantity ?? 0) + 1,
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }

      case "batch": {
        const {
          fromShelfId,
          stockTransferId,
          stockTransferLineId,
          trackedEntityId,
          quantity,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          // Get tracked entity details
          const trackedEntity = await trx
            .selectFrom("trackedEntity")
            .where("id", "=", trackedEntityId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          const entityQuantity = Number(trackedEntity.quantity);
          const transferQuantity = quantity;
          const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
            [];

          // Handle batch splitting if needed
          if (entityQuantity !== transferQuantity) {
            // Need to split the batch
            const remainingQuantity = entityQuantity - transferQuantity;
            const newTrackedEntityId = nanoid();

            // Create split activity
            const splitActivityId = nanoid();
            await trx
              .insertInto("trackedActivity")
              .values({
                id: splitActivityId,
                type: "Split",
                sourceDocument: "Stock Transfer",
                sourceDocumentId: stockTransferId,
                attributes: {
                  "Original Quantity": entityQuantity,
                  "Transfer Quantity": transferQuantity,
                  "Remaining Quantity": remainingQuantity,
                  "Split Entity ID": newTrackedEntityId,
                },
                companyId,
                createdBy: userId,
              })
              .execute();

            // Record original entity as input to split
            await trx
              .insertInto("trackedActivityInput")
              .values({
                trackedActivityId: splitActivityId,
                trackedEntityId: trackedEntityId,
                quantity: entityQuantity,
                companyId,
                createdBy: userId,
              })
              .execute();

            // Create new tracked entity for remaining quantity
            await trx
              .insertInto("trackedEntity")
              .values({
                id: newTrackedEntityId,
                sourceDocument: trackedEntity.sourceDocument,
                sourceDocumentId: trackedEntity.sourceDocumentId,
                sourceDocumentReadableId:
                  trackedEntity.sourceDocumentReadableId,
                quantity: remainingQuantity,
                status: "Available",
                attributes: trackedEntity.attributes,
                companyId,
                createdBy: userId,
              })
              .execute();

            // Record outputs from split
            await trx
              .insertInto("trackedActivityOutput")
              .values([
                {
                  trackedActivityId: splitActivityId,
                  trackedEntityId: newTrackedEntityId,
                  quantity: remainingQuantity,
                  companyId,
                  createdBy: userId,
                },
                {
                  trackedActivityId: splitActivityId,
                  trackedEntityId: trackedEntityId,
                  quantity: transferQuantity,
                  companyId,
                  createdBy: userId,
                },
              ])
              .execute();

            // Update original entity with split reference and new quantity
            await trx
              .updateTable("trackedEntity")
              .set({
                quantity: transferQuantity,
                attributes: {
                  ...(trackedEntity.attributes as Record<string, unknown>),
                  "Split Entity ID": newTrackedEntityId,
                },
              })
              .where("id", "=", trackedEntityId)
              .execute();

            // Create item ledger entries for split
            itemLedgerInserts.push(
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: -entityQuantity,
                locationId: locationId,
                shelfId: fromShelfId,
                entryType: "Negative Adjmt.",
                documentType: "Batch Split",
                documentId: splitActivityId,
                trackedEntityId: trackedEntityId,
                createdBy: userId,
                companyId,
              },
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: transferQuantity,
                locationId: locationId,
                shelfId: fromShelfId,
                entryType: "Positive Adjmt.",
                documentType: "Batch Split",
                documentId: splitActivityId,
                trackedEntityId: trackedEntityId,
                createdBy: userId,
                companyId,
              },
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: remainingQuantity,
                locationId: locationId,
                shelfId: fromShelfId,
                entryType: "Positive Adjmt.",
                documentType: "Batch Split",
                documentId: splitActivityId,
                trackedEntityId: newTrackedEntityId,
                createdBy: userId,
                companyId,
              }
            );
          }

          // Create transfer activity
          const transferActivityId = nanoid();
          await trx
            .insertInto("trackedActivity")
            .values({
              id: transferActivityId,
              type: "Transfer",
              sourceDocument: "Stock Transfer",
              sourceDocumentId: stockTransferId,
              attributes: {
                "Stock Transfer": stockTransferId,
                "Stock Transfer Line": stockTransferLineId,
                "From Location": locationId,
                "To Location": locationId,
                "From Shelf": stockTransferLine.fromShelfId,
                "To Shelf": stockTransferLine.toShelfId,
              },
              companyId,
              createdBy: userId,
            })
            .execute();

          // Record tracked entity as input to transfer
          await trx
            .insertInto("trackedActivityInput")
            .values({
              trackedActivityId: transferActivityId,
              trackedEntityId: trackedEntityId,
              quantity: transferQuantity,
              companyId,
              createdBy: userId,
            })
            .execute();

          // Update tracked entity status to consumed
          await trx
            .updateTable("trackedEntity")
            .set({
              status: "Consumed",
            })
            .where("id", "=", trackedEntityId)
            .execute();

          // Create item ledger entries for transfer
          itemLedgerInserts.push(
            {
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: -transferQuantity,
              locationId: locationId,
              shelfId: fromShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              trackedEntityId: trackedEntityId,
              createdBy: userId,
              companyId,
            },
            {
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: transferQuantity,
              locationId: locationId,
              shelfId: stockTransferLine.toShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              trackedEntityId: trackedEntityId,
              createdBy: userId,
              companyId,
            }
          );

          // Insert item ledger entries
          if (itemLedgerInserts.length > 0) {
            await trx
              .insertInto("itemLedger")
              .values(itemLedgerInserts)
              .execute();
          }

          // Update stock transfer line with picked quantity
          await trx
            .updateTable("stockTransferLine")
            .set({
              trackedEntityId,
              fromShelfId: fromShelfId,
              pickedQuantity: transferQuantity,
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }

      case "unpickSerial": {
        const {
          stockTransferId,
          stockTransferLineId,
          trackedEntityId,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          // Get tracked entity details
          const trackedEntity = await trx
            .selectFrom("trackedEntity")
            .where("id", "=", trackedEntityId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          // Find the transfer activity for this tracked entity
          const transferActivity = await trx
            .selectFrom("trackedActivity")
            .innerJoin(
              "trackedActivityInput",
              "trackedActivity.id",
              "trackedActivityInput.trackedActivityId"
            )
            .where("trackedActivity.type", "=", "Transfer")
            .where("trackedActivity.sourceDocument", "=", "Stock Transfer")
            .where("trackedActivity.sourceDocumentId", "=", stockTransferId)
            .where("trackedActivityInput.trackedEntityId", "=", trackedEntityId)
            .where("trackedActivity.companyId", "=", companyId)
            .selectAll("trackedActivity")
            .executeTakeFirstOrThrow();

          const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
            [];

          // Create reverse item ledger entries to undo the transfer
          // First, remove the entity from the destination shelf (toShelfId)
          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: -1, // Negative to remove inventory from to shelf
            locationId: locationId,
            shelfId: stockTransferLine.toShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            trackedEntityId: trackedEntityId,
            createdBy: userId,
            companyId,
          });

          // Then, restore the entity to the source shelf (fromShelfId)
          itemLedgerInserts.push({
            postingDate: today,
            itemId: stockTransferLine.itemId,
            quantity: 1, // Positive to restore inventory at from shelf
            locationId: locationId,
            shelfId: stockTransferLine.fromShelfId,
            entryType: "Transfer",
            documentType: "Direct Transfer",
            documentId: stockTransferId,
            trackedEntityId: trackedEntityId,
            createdBy: userId,
            companyId,
          });

          // Insert reverse item ledger entries
          if (itemLedgerInserts.length > 0) {
            await trx
              .insertInto("itemLedger")
              .values(itemLedgerInserts)
              .execute();
          }

          // Delete the tracked activity and its related records
          await trx
            .deleteFrom("trackedActivityInput")
            .where("trackedActivityId", "=", transferActivity.id!)
            .execute();

          await trx
            .deleteFrom("trackedActivity")
            .where("id", "=", transferActivity.id!)
            .execute();

          // Update tracked entity status back to available and restore shelf location
          await trx
            .updateTable("trackedEntity")
            .set({
              status: "Available",
              attributes: {
                ...(trackedEntity.attributes as Record<string, unknown>),
                Shelf: stockTransferLine.fromShelfId,
              },
            })
            .where("id", "=", trackedEntityId)
            .execute();

          // Update stock transfer line with reduced picked quantity
          await trx
            .updateTable("stockTransferLine")
            .set({
              trackedEntityId: null,
              pickedQuantity: Math.max(
                0,
                (stockTransferLine.pickedQuantity ?? 0) - 1
              ),
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }

      case "unpickBatch": {
        const {
          stockTransferId,
          stockTransferLineId,
          trackedEntityId,
          locationId,
          userId,
          companyId,
        } = validatedPayload;

        await db.transaction().execute(async (trx) => {
          // Get stock transfer line details
          const stockTransferLine = await trx
            .selectFrom("stockTransferLine")
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          // Get tracked entity details
          const trackedEntity = await trx
            .selectFrom("trackedEntity")
            .where("id", "=", trackedEntityId)
            .where("companyId", "=", companyId)
            .selectAll()
            .executeTakeFirstOrThrow();

          // Find the transfer activity for this tracked entity
          const transferActivity = await trx
            .selectFrom("trackedActivity")
            .innerJoin(
              "trackedActivityInput",
              "trackedActivity.id",
              "trackedActivityInput.trackedActivityId"
            )
            .where("trackedActivity.type", "=", "Transfer")
            .where("trackedActivity.sourceDocument", "=", "Stock Transfer")
            .where("trackedActivity.sourceDocumentId", "=", stockTransferId)
            .where("trackedActivityInput.trackedEntityId", "=", trackedEntityId)
            .where("trackedActivity.companyId", "=", companyId)
            .selectAll("trackedActivity")
            .executeTakeFirstOrThrow();

          const transferQuantity = Number(trackedEntity.quantity);
          const itemLedgerInserts: Database["public"]["Tables"]["itemLedger"]["Insert"][] =
            [];

          // Check if this entity was created from a split operation
          const splitEntityId = (
            trackedEntity.attributes as Record<string, unknown>
          )?.["Split Entity ID"] as string | undefined;

          if (splitEntityId) {
            // This entity was created from a split, need to merge it back
            const originalEntity = await trx
              .selectFrom("trackedEntity")
              .where("id", "=", splitEntityId)
              .where("companyId", "=", companyId)
              .selectAll()
              .executeTakeFirstOrThrow();

            const originalQuantity =
              Number(originalEntity.quantity) + transferQuantity;

            const remainingQuantity = (
              trackedEntity.attributes as Record<string, unknown>
            )?.["Remaining Quantity"] as number | undefined;

            // Find the split activity
            const splitActivity = await trx
              .selectFrom("trackedActivity")
              .where("type", "=", "Split")
              .where("sourceDocument", "=", "Stock Transfer")
              .where("sourceDocumentId", "=", stockTransferId)
              .where("companyId", "=", companyId)
              .selectAll()
              .executeTakeFirstOrThrow();

            // Update original entity with merged quantity and restore shelf location
            await trx
              .updateTable("trackedEntity")
              .set({
                status: "Consumed",
                quantity: 0,
              })
              .where("id", "=", splitEntityId)
              .execute();

            // Mark the split entity as consumed (don't delete it)
            await trx
              .updateTable("trackedEntity")
              .set({
                status: "Available",
                quantity: originalQuantity,
              })
              .where("id", "=", trackedEntityId)
              .execute();

            // Create item ledger entries for merge
            // Both entities are on the fromShelfId during the merge operation
            itemLedgerInserts.push(
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: originalQuantity, // zero out the split entity
                locationId: locationId,
                shelfId: stockTransferLine.fromShelfId,
                entryType: "Positive Adjmt.",
                documentType: "Direct Transfer",
                documentId: stockTransferId!,
                trackedEntityId: trackedEntityId,
                createdBy: userId,
                companyId,
              },
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: -transferQuantity, // Positive to restore to original entity
                locationId: locationId,
                shelfId: stockTransferLine.toShelfId, // Both entities are on the source shelf
                entryType: "Negative Adjmt.",
                documentType: "Direct Transfer",
                documentId: stockTransferId!,
                trackedEntityId: trackedEntityId,
                createdBy: userId,
                companyId,
              },
              {
                postingDate: today,
                itemId: stockTransferLine.itemId,
                quantity: -(originalQuantity - transferQuantity), // Positive to restore to original entity
                locationId: locationId,
                shelfId: stockTransferLine.fromShelfId, // Both entities are on the source shelf
                entryType: "Negative Adjmt.",
                documentType: "Direct Transfer",
                documentId: stockTransferId!,
                trackedEntityId: splitEntityId,
                createdBy: userId,
                companyId,
              }
            );

            // Delete split activity records
            await trx
              .deleteFrom("trackedActivityOutput")
              .where("trackedActivityId", "=", splitActivity.id!)
              .execute();

            await trx
              .deleteFrom("trackedActivityInput")
              .where("trackedActivityId", "=", splitActivity.id!)
              .execute();

            await trx
              .deleteFrom("trackedActivity")
              .where("id", "=", splitActivity.id!)
              .execute();
          } else {
            // This was a direct transfer, just restore the entity and shelf location
            await trx
              .updateTable("trackedEntity")
              .set({
                status: "Available",
                attributes: {
                  ...(trackedEntity.attributes as Record<string, unknown>),
                  Shelf: stockTransferLine.fromShelfId,
                },
              })
              .where("id", "=", trackedEntityId)
              .execute();

            // Create reverse item ledger entries to undo the transfer
            // Use the correct trackedEntityId based on whether this was a split operation
            // For split operations, use the original entity (splitEntityId)
            // For direct operations, use the trackedEntityId
            const finalTrackedEntityId = splitEntityId || trackedEntityId;

            itemLedgerInserts.push({
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: transferQuantity, // Positive to restore inventory at from shelf
              locationId: locationId,
              shelfId: stockTransferLine.fromShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              trackedEntityId: finalTrackedEntityId,
              createdBy: userId,
              companyId,
            });

            itemLedgerInserts.push({
              postingDate: today,
              itemId: stockTransferLine.itemId,
              quantity: -transferQuantity, // Negative to remove inventory from to shelf
              locationId: locationId,
              shelfId: stockTransferLine.toShelfId,
              entryType: "Transfer",
              documentType: "Direct Transfer",
              documentId: stockTransferId,
              trackedEntityId: finalTrackedEntityId,
              createdBy: userId,
              companyId,
            });
          }

          // Insert item ledger entries
          if (itemLedgerInserts.length > 0) {
            await trx
              .insertInto("itemLedger")
              .values(itemLedgerInserts)
              .execute();
          }

          // Delete the transfer activity and its related records
          await trx
            .deleteFrom("trackedActivityInput")
            .where("trackedActivityId", "=", transferActivity.id!)
            .execute();

          await trx
            .deleteFrom("trackedActivity")
            .where("id", "=", transferActivity.id!)
            .execute();

          // Update stock transfer line with reduced picked quantity
          await trx
            .updateTable("stockTransferLine")
            .set({
              trackedEntityId: null,
              pickedQuantity: Math.max(
                0,
                (stockTransferLine.pickedQuantity ?? 0) - transferQuantity
              ),
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .where("id", "=", stockTransferLineId)
            .where("companyId", "=", companyId)
            .execute();
        });

        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify(err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
