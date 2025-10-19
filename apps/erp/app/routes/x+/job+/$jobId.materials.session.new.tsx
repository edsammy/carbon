import { error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validator } from "@carbon/form";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { z } from "zod";
import {
  deleteStockTransfer,
  getDefaultShelfForJob,
  upsertStockTransfer,
  upsertStockTransferLines,
} from "~/modules/inventory";
import { getItem } from "~/modules/items";
import { getJob, upsertJob, upsertJobMethod } from "~/modules/production";
import { upsertPurchaseOrder } from "~/modules/purchasing";
import { getNextSequence } from "~/modules/settings";

const jobMaterialsSessionValidator = z.object({
  jobId: z.string(),
  items: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      const itemsSchema = z.array(
        z.object({
          id: z.string(), // Job material ID
          itemId: z.string(), // Actual item ID
          itemReadableId: z.string(),
          description: z.string(),
          action: z.enum(["order", "transfer"]),
          quantity: z.number().optional(),
          requiresSerialTracking: z.boolean(),
          requiresBatchTracking: z.boolean(),
          shelfId: z.string().optional(),
        })
      );
      return itemsSchema.parse(parsed);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON format for items",
      });
      return z.NEVER;
    }
  }),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "production",
  });

  const { jobId } = params;
  if (!jobId) throw new Error("Job ID is required");

  const formData = await request.formData();

  const validation = await validator(jobMaterialsSessionValidator).validate(
    formData
  );

  if (validation.error) {
    return json(
      { success: false, message: "Invalid session data" },
      await flash(request, error(validation.error, "Invalid session data"))
    );
  }

  const { items: sessionItems } = validation.data;

  // Get job information to determine location
  const jobResult = await getJob(client, jobId);
  if (jobResult.error || !jobResult.data) {
    return json(
      { success: false, message: "Failed to get job information" },
      await flash(
        request,
        error(jobResult.error, "Failed to get job information")
      )
    );
  }

  const job = jobResult.data;
  const locationId = job.locationId;

  if (!locationId) {
    return json(
      { success: false, message: "Job location is required" },
      await flash(
        request,
        error("Job location is required", "Invalid job configuration")
      )
    );
  }

  const transferItems = sessionItems.filter(
    (item) => item.action === "transfer"
  );

  const orderItems = sessionItems.filter((item) => item.action === "order");

  let hasTransfer = false;
  let hasPurchaseOrder = false;
  let hasJobs = false;

  if (transferItems.length > 0) {
    // Process transfer items and build transfer lines first
    // Only create stock transfer after validating we have valid lines
    const transferLines = [];

    for await (const item of transferItems) {
      if (!item.shelfId || !item.quantity || !item.id) {
        continue;
      }

      // Find available sources for this item (excluding the target shelf)
      const { data: availableSources, error: sourcesError } = await client.rpc(
        "get_item_shelf_requirements_by_location_and_item",
        {
          company_id: companyId,
          location_id: locationId,
          item_id: item.itemId,
        }
      );

      if (sourcesError) {
        continue;
      }

      // Filter out the target shelf and only include shelves with available quantity
      const validSources =
        availableSources?.filter(
          (source) =>
            source.shelfId !== item.shelfId &&
            source.quantityOnHandInShelf > source.quantityRequiredByShelf
        ) || [];

      if (validSources.length === 0) {
        continue;
      }

      // Sort sources by available quantity (descending) to prioritize shelves with more stock
      validSources.sort((a, b) => {
        const aAvailable = a.quantityOnHandInShelf - a.quantityRequiredByShelf;
        const bAvailable = b.quantityOnHandInShelf - b.quantityRequiredByShelf;
        return bAvailable - aAvailable;
      });

      // Distribute the required quantity across available sources
      let remainingQuantity = item.quantity;

      for (const source of validSources) {
        if (remainingQuantity <= 0) break;

        const availableQuantity =
          source.quantityOnHandInShelf - source.quantityRequiredByShelf;
        const transferQuantity = Math.min(remainingQuantity, availableQuantity);

        if (transferQuantity > 0) {
          const transferLine = {
            itemId: item.itemId, // Use the actual item ID, not the job material ID
            fromShelfId: source.shelfId,
            toShelfId: item.shelfId,
            quantity: transferQuantity,
            requiresSerialTracking: item.requiresSerialTracking,
            requiresBatchTracking: item.requiresBatchTracking,
          };

          transferLines.push(transferLine);
          remainingQuantity -= transferQuantity;
        }
      }
    }

    // Expand lines with serial tracking (similar to stock transfer new.tsx)
    const linesWithExpandedSerialTracking = transferLines.reduce<
      typeof transferLines
    >((acc, line) => {
      // If quantity contains a decimal, ignore the line (as per requirements)
      if (line.quantity && !Number.isInteger(line.quantity)) {
        return acc;
      }

      // If item requires serial tracking and quantity is a whole number > 1
      if (line.requiresSerialTracking && line.quantity && line.quantity > 1) {
        // Break out into multiple lines with quantity 1
        acc.push(
          ...Array.from({ length: line.quantity }, () => ({
            ...line,
            quantity: 1,
          }))
        );
      } else {
        acc.push(line);
      }
      return acc;
    }, []);

    if (linesWithExpandedSerialTracking.length === 0) {
      // No valid transfer lines, skip creating the stock transfer
      return json(
        { success: false, message: "No valid transfer lines could be created" },
        await flash(
          request,
          error(
            "No valid transfer lines could be created",
            "No transfers created"
          )
        )
      );
    }

    // Now that we have valid transfer lines, create the stock transfer
    // Get next sequence for stock transfer
    const nextSequence = await getNextSequence(
      client,
      "stockTransfer",
      companyId
    );
    if (nextSequence.error) {
      return json(
        { success: false, message: "Failed to get next sequence" },
        await flash(
          request,
          error(nextSequence.error, "Failed to get next sequence")
        )
      );
    }

    // Create stock transfer
    const createStockTransfer = await upsertStockTransfer(client, {
      stockTransferId: nextSequence.data,
      locationId,
      companyId,
      createdBy: userId,
    });

    if (createStockTransfer.error) {
      return json(
        { success: false, message: "Failed to create stock transfer" },
        await flash(
          request,
          error(createStockTransfer.error, "Failed to create stock transfer")
        )
      );
    }

    // Create stock transfer lines
    const createStockTransferLines = await upsertStockTransferLines(client, {
      lines: linesWithExpandedSerialTracking,
      stockTransferId: createStockTransfer.data.id,
      companyId,
      createdBy: userId,
    });

    if (createStockTransferLines.error) {
      await deleteStockTransfer(client, createStockTransfer.data.id);
      return json(
        { success: false, message: "Failed to create stock transfer lines" },
        await flash(
          request,
          error(
            createStockTransferLines.error,
            "Failed to create stock transfer lines"
          )
        )
      );
    }

    hasTransfer = true;
  }

  // Handle "order" items (purchase orders and jobs)
  if (orderItems.length > 0) {
    // Get item details for all order items to determine make/buy
    const itemDetails = await Promise.all(
      orderItems.map(async (item) => {
        const itemResult = await getItem(client, item.itemId);
        return {
          ...item,
          itemDetails: itemResult.data,
          itemError: itemResult.error,
        };
      })
    );

    // Separate items into make vs buy based on replenishment system
    // If replenishment system is "Buy and Make", treat as "Buy" (purchase order)
    const buyItems = itemDetails.filter(
      (item) =>
        !item.itemError &&
        item.itemDetails &&
        (item.itemDetails.replenishmentSystem === "Buy" ||
          item.itemDetails.replenishmentSystem === "Buy and Make")
    );

    const makeItems = itemDetails.filter(
      (item) =>
        !item.itemError &&
        item.itemDetails &&
        item.itemDetails.replenishmentSystem === "Make"
    );

    // Create purchase orders for buy items
    if (buyItems.length > 0) {
      // Get supplier information for buy items
      const buyItemIds = buyItems.map((item) => item.itemId);
      const { data: supplierParts, error: supplierPartsError } = await client
        .from("supplierPart")
        .select("itemId, supplierId, unitPrice, supplierUnitOfMeasureCode")
        .in("itemId", buyItemIds)
        .eq("companyId", companyId);

      if (supplierPartsError) {
        // Continue without supplier parts
      }

      // Group items by supplier
      const itemsBySupplier = new Map<string, typeof buyItems>();

      for (const item of buyItems) {
        const supplierPart = supplierParts?.find(
          (sp) => sp.itemId === item.itemId
        );
        const supplierId = supplierPart?.supplierId || "NO_SUPPLIER";

        if (!itemsBySupplier.has(supplierId)) {
          itemsBySupplier.set(supplierId, []);
        }
        itemsBySupplier.get(supplierId)!.push(item);
      }

      // Create purchase orders for each supplier group
      for (const [supplierId, items] of itemsBySupplier.entries()) {
        if (supplierId === "NO_SUPPLIER") {
          continue;
        }

        // Validate that we have valid items with quantities before creating purchase order
        // This prevents creating empty purchase orders and wasting sequence numbers
        const validItems = items.filter(
          (item) => item.quantity && item.quantity > 0
        );

        if (validItems.length === 0) {
          continue;
        }

        try {
          // Get next sequence for purchase order
          const nextSequence = await getNextSequence(
            client,
            "purchaseOrder",
            companyId
          );

          if (nextSequence.error) {
            continue;
          }

          // Create purchase order
          const createPurchaseOrder = await upsertPurchaseOrder(client, {
            purchaseOrderId: nextSequence.data,
            purchaseOrderType: "Purchase",
            supplierId: supplierId,
            companyId,
            createdBy: userId,
          });

          if (createPurchaseOrder.error) {
            continue;
          }

          // TODO: Add purchase order lines for each valid item
          // This would require implementing purchase order line creation

          hasPurchaseOrder = true;
        } catch (error) {
          // Continue to next supplier
        }
      }
    }

    // Create jobs for make items
    if (makeItems.length > 0) {
      for (const item of makeItems) {
        try {
          if (!item.quantity || item.quantity <= 0) {
            continue;
          }

          // Get next sequence for job
          const nextSequence = await getNextSequence(client, "job", companyId);

          if (nextSequence.error) {
            continue;
          }

          const shelfId = await getDefaultShelfForJob(
            client,
            item.itemId,
            locationId,
            companyId
          );

          const createJob = await upsertJob(
            client,
            {
              jobId: nextSequence.data,
              itemId: item.itemId,
              quantity: item.quantity,
              scrapQuantity: 0, // Default to 0 for now
              locationId: locationId,
              unitOfMeasureCode: item.itemDetails?.unitOfMeasureCode || "EA", // Default to "EA" if not specified
              deadlineType: "ASAP", // Default to ASAP for job materials
              shelfId: shelfId ?? undefined,
              companyId,
              createdBy: userId,
            },
            "Planned"
          );

          if (createJob.error) {
            continue;
          }

          const jobId = createJob.data?.id;
          if (!jobId) {
            continue;
          }

          // Create job method to link the item to the job
          const upsertMethod = await upsertJobMethod(client, "itemToJob", {
            sourceId: item.itemId,
            targetId: jobId,
            companyId,
            userId,
          });

          if (upsertMethod.error) {
            // Continue anyway as the job was created successfully
          }

          // TODO: Trigger job requirements recalculation
          // This would typically be done with a background job

          hasJobs = true;
        } catch (error) {
          // Continue to next item
        }
      }
    }
  }

  // TODO: Update job material statuses
  // TODO: Send notifications

  // Determine what was created for the success message
  const createdItems = [];
  if (hasTransfer) createdItems.push("stock transfer");
  if (hasPurchaseOrder) createdItems.push("purchase order(s)");
  if (hasJobs) createdItems.push("job(s)");

  const successMessage =
    createdItems.length > 0
      ? `Successfully created ${createdItems.join(", ")}`
      : "Session processed successfully, but without any transfers or orders";

  return json(
    { success: true, message: successMessage },
    await flash(request, success(successMessage))
  );
}
