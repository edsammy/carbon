import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const carbon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    global: {
      headers: {
        "carbon-key": "crbn_**************",
      },
    },
  }
);

(async () => {
  const employees = await carbon.from("employees").select("*").limit(1000);

  console.log(employees);
})();
