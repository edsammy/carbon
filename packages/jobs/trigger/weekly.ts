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
