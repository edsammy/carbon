// import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();
(async () => {
  const supabase = createClient(
    process.env.GOVCLOUD_SUPABASE_URL!,
    process.env.GOVCLOUD_SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Upload to test bucket
    const { data, error } = await supabase.functions.invoke("seed-company", {});

    console.log({ data, error });
  } catch (err) {
    console.error("Error:", err);
  }
})();
