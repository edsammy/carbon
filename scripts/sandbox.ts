import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const carbon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const companyId = "fkeqqGSn7VGrHtjk8LVFz";

(async () => {
  const holidays = await carbon
    .from("holiday")
    .select("*")
    .eq("companyId", companyId)
    .gte("date", new Date().toISOString())
    .lte(
      "date",
      new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
    );

  console.log(holidays);
})();
