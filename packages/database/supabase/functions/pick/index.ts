import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";
import { z } from "npm:zod@^3.24.1";

import { DB, getConnectionPool, getDatabaseClient } from "../lib/database.ts";
import { getSupabaseServiceRole } from "../lib/supabase.ts";

import { corsHeaders } from "../lib/headers.ts";
import { getNextSequence } from "../shared/get-next-sequence.ts";

const pool = getConnectionPool(1);
const db = getDatabaseClient<DB>(pool);

const payloadValidator = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stageJob"),
    jobId: z.string(),
    companyId: z.string(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal("generatePickList"),
    locationId: z.string(),
    jobIds: z.array(z.string()).optional(),
    companyId: z.string(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal("executePick"),
    pickListLineId: z.string(),
    pickedQuantity: z.number(),
    companyId: z.string(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal("completePickList"),
    pickListId: z.string(),
    companyId: z.string(),
    userId: z.string(),
  }),
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const payload = await req.json();

  try {
    const { type, companyId, userId } = payloadValidator.parse(payload);

    console.log({
      function: "pick",
      type,
      companyId,
      userId,
    });

    const client = await getSupabaseServiceRole(
      req.headers.get("Authorization"),
      req.headers.get("carbon-key") ?? "",
      companyId
    );

    switch (type) {
      case "stageJob": {
        const { jobId } = payload;

        // Get job and its location
        const { data: job, error: jobError } = await client
          .from("job")
          .select("*, locationId")
          .eq("id", jobId)
          .eq("companyId", companyId)
          .single();

        if (jobError || !job) {
          return new Response(JSON.stringify({ error: "Job not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (job.status !== "Draft") {
          return new Response(
            JSON.stringify({ error: "Only draft jobs can be staged" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Get all job materials with their shelf requirements
        const { data: jobMaterials, error: materialsError } = await client
          .from("jobMaterial")
          .select("*, item:itemId(id, name, readableId)")
          .eq("jobId", jobId)
          .eq("companyId", companyId);

        if (materialsError) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch job materials" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Get inventory quantities for each material
        const warnings = [];
        for (const material of jobMaterials || []) {
          const { data: inventory } = await client.rpc(
            "get_inventory_quantities",
            {
              p_company_id: companyId,
              p_item_id: material.itemId,
              p_location_id: job.locationId,
            }
          );

          const quantityOnHand = inventory?.[0]?.quantityOnHand || 0;
          const requiredQuantity = material.quantity;

          if (quantityOnHand < requiredQuantity) {
            warnings.push({
              itemId: material.itemId,
              itemName: material.item?.name,
              required: requiredQuantity,
              available: quantityOnHand,
              shortage: requiredQuantity - quantityOnHand,
              shelfId: material.shelfId,
            });
          }
        }

        // Update job status to Staged
        const { error: updateError } = await client
          .from("job")
          .update({
            status: "Staged",
            updatedBy: userId,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("companyId", companyId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: "Failed to update job status" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            jobId,
            warnings,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "generatePickList": {
        const { locationId, jobIds } = payload;

        // Get all staged jobs at this location
        let jobQuery = client
          .from("job")
          .select("id, locationId, shelfId")
          .eq("companyId", companyId)
          .eq("locationId", locationId)
          .eq("status", "Staged");

        if (jobIds && jobIds.length > 0) {
          jobQuery = jobQuery.in("id", jobIds);
        }

        const { data: jobs, error: jobsError } = await jobQuery;

        if (jobsError || !jobs || jobs.length === 0) {
          return new Response(
            JSON.stringify({ error: "No staged jobs found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Create pick list
        const pickListId = `PL-${nanoid(10)}`;
        const { error: pickListError } = await client.from("pickList").insert({
          id: pickListId,
          locationId,
          status: "Draft",
          companyId,
          createdBy: userId,
        });

        if (pickListError) {
          return new Response(
            JSON.stringify({ error: "Failed to create pick list" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Aggregate materials from all jobs
        const pickListLines = [];
        for (const job of jobs) {
          const { data: jobMaterials } = await client
            .from("jobMaterial")
            .select("*")
            .eq("jobId", job.id)
            .eq("companyId", companyId);

          for (const material of jobMaterials || []) {
            if (material.shelfId || job.shelfId) {
              pickListLines.push({
                id: `PLL-${nanoid(10)}`,
                pickListId,
                jobId: job.id,
                jobMaterialId: material.id,
                itemId: material.itemId,
                fromShelfId: material.shelfId,
                toShelfId: job.shelfId,
                quantity: material.quantity,
                pickedQuantity: 0,
                companyId,
                createdBy: userId,
              });
            }
          }
        }

        if (pickListLines.length > 0) {
          const { error: linesError } = await client
            .from("pickListLine")
            .insert(pickListLines);

          if (linesError) {
            return new Response(
              JSON.stringify({ error: "Failed to create pick list lines" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            pickListId,
            linesCreated: pickListLines.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "executePick": {
        const { pickListLineId, pickedQuantity } = payload;

        return await db.transaction().execute(async (trx) => {
          // Get the pick list line
          const { data: pickListLine, error: lineError } = await client
            .from("pickListLine")
            .select("*, pickList:pickListId(locationId)")
            .eq("id", pickListLineId)
            .eq("companyId", companyId)
            .single();

          if (lineError || !pickListLine) {
            return new Response(
              JSON.stringify({ error: "Pick list line not found" }),
              {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Update picked quantity
          const { error: updateError } = await client
            .from("pickListLine")
            .update({
              pickedQuantity,
              updatedBy: userId,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", pickListLineId)
            .eq("companyId", companyId);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: "Failed to update pick list line" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Create item ledger entry for the transfer
          if (pickListLine.fromShelfId && pickListLine.toShelfId) {
            const ledgerSequence = await getNextSequence(
              trx,
              "itemLedger",
              companyId
            );

            await trx
              .insertInto("itemLedger")
              .values({
                id: `IL-${ledgerSequence}`,
                companyId,
                entryType: "Transfer",
                documentType: "Pick Transfer",
                documentId: pickListLineId,
                itemId: pickListLine.itemId,
                locationId: pickListLine.pickList?.locationId,
                shelfId: pickListLine.fromShelfId,
                quantity: -pickedQuantity,
                postingDate: new Date(),
                createdBy: userId,
              })
              .execute();

            await trx
              .insertInto("itemLedger")
              .values({
                id: `IL-${ledgerSequence + 1}`,
                companyId,
                entryType: "Transfer",
                documentType: "Pick Transfer",
                documentId: pickListLineId,
                itemId: pickListLine.itemId,
                locationId: pickListLine.pickList?.locationId,
                shelfId: pickListLine.toShelfId,
                quantity: pickedQuantity,
                postingDate: new Date(),
                createdBy: userId,
              })
              .execute();
          }

          return new Response(
            JSON.stringify({
              success: true,
              pickListLineId,
              pickedQuantity,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        });
      }

      case "completePickList": {
        const { pickListId } = payload;

        // Verify all lines are fully picked
        const { data: lines, error: linesError } = await client
          .from("pickListLine")
          .select("id, quantity, pickedQuantity")
          .eq("pickListId", pickListId)
          .eq("companyId", companyId);

        if (linesError) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch pick list lines" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const incomplete = lines?.filter(
          (line) => line.pickedQuantity < line.quantity
        );

        if (incomplete && incomplete.length > 0) {
          return new Response(
            JSON.stringify({
              error: "Not all lines are fully picked",
              incompleteLines: incomplete.length,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Update pick list status
        const { error: updateError } = await client
          .from("pickList")
          .update({
            status: "Completed",
            completedDate: new Date().toISOString(),
            updatedBy: userId,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", pickListId)
          .eq("companyId", companyId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: "Failed to complete pick list" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            pickListId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid operation type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error in pick:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
