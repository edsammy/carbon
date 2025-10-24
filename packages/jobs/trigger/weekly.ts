import { getCarbonServiceRole } from "@carbon/auth";
import { schedules } from "@trigger.dev/sdk/v3";
import { Edition } from "../../utils/src/types.ts";

const serviceRole = getCarbonServiceRole();

export const weekly = schedules.task({
  id: "weekly",
  // Run every Sunday at 9pm
  cron: "0 21 * * 0",
  run: async () => {
    console.log(`📅 Starting weekly tasks: ${new Date().toISOString()}`);

    try {
      if (process.env.CARBON_EDITION === Edition.Cloud || true) {
        const bypassUrl = `${process.env.VERCEL_URL}/api/settings/bypass`;
        const bypassResponse = await fetch(bypassUrl);
        if (!bypassResponse.ok) {
          console.error(
            `Failed to fetch bypass list: ${bypassResponse.statusText}`
          );
          return;
        }
        const bypassData = (await bypassResponse.json()) as {
          bypassList?: string[];
        };
        const bypassList = bypassData.bypassList ?? [];

        console.log(`Bypass list: ${bypassList}`);

        // Get all companies
        const { data: companies, error: companiesError } = await serviceRole
          .from("company")
          .select("id, name, createdAt");

        if (companiesError) {
          console.error(`Failed to fetch companies: ${companiesError.message}`);
          return;
        }

        console.log(`Found ${companies?.length || 0} companies`);

        // Get all company plans
        const { data: companyPlans, error: plansError } = await serviceRole
          .from("companyPlan")
          .select("id, stripeSubscriptionStatus");

        if (plansError) {
          console.error(`Failed to fetch company plans: ${plansError.message}`);
          return;
        }

        // Create a map of company plans for quick lookup
        const planMap = new Map(
          companyPlans?.map((plan) => [
            plan.id,
            plan.stripeSubscriptionStatus,
          ]) || []
        );

        // Filter companies to delete
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const companiesToDelete =
          companies?.filter((company) => {
            if (planMap.get(company.id) === "Canceled") {
              return true;
            }

            if (bypassList.includes(company.id)) {
              return false;
            }

            if (planMap.get(company.id)) {
              return false;
            }

            // Keep companies created in the last week
            const createdAt = new Date(company.createdAt);
            if (createdAt > oneWeekAgo) {
              return false;
            }

            // Delete this company
            return true;
          }) || [];

        console.log(`Companies to delete: ${companiesToDelete.length}`);

        const { error: deletedCompaniesError } = await serviceRole
          .from("company")
          .delete()
          .in(
            "id",
            companiesToDelete.map((company) => company.id)
          );

        if (deletedCompaniesError) {
          console.error(
            `Failed to delete companies: ${deletedCompaniesError.message}`
          );
          return;
        } else {
          console.log(`Deleted ${companiesToDelete.length} companies`);
          for (const company of companiesToDelete) {
            console.log(`Deleted company ${company.name}`);
          }
        }
      }

      console.log(`📅 Weekly tasks completed: ${new Date().toISOString()}`);
    } catch (error) {
      console.error(
        `Unexpected error in weekly tasks: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
