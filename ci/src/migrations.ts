import { $ } from "execa";

import { client } from "./client";
import {
  SUPABASE_ACCESS_TOKEN,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_REDIRECT_URI,
} from "./env";

export type Customer = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  seeded: boolean;
  database_url: string | null;
  project_id: string | null;
  decrypted_access_token: string | null;
  decrypted_anon_key: string | null;
  decrypted_database_password: string | null;
  decrypted_jwt_key: string | null;
  decrypted_service_role_key: string | null;
  latest_migration: string | null;
};

async function migrate(): Promise<void> {
  console.log("✅ 🌱 Starting migrations");

  const { data: customers, error } = await client
    .from("decrypted_customer")
    .select("*");

  if (error) {
    console.error("🔴 🍳 Failed to fetch customers", error);
    return;
  }

  console.log("✅ 🛩️ Successfully retreived customers");

  console.log("👯‍♀️ Copying supabase folder");
  await $`cp -r ../packages/database/supabase .`;

  for await (const customer of customers as Customer[]) {
    try {
      console.log(`✅ 🥚 Migrating ${customer.id}`);
      const {
        database_url,
        decrypted_database_password,
        decrypted_service_role_key,
        project_id,
        decrypted_access_token,
      } = customer;
      if (!database_url) {
        console.log(`🔴🍳 Missing database url for ${customer.id}`);
        continue;
      }

      console.log(`✅ 🔑 Setting up environment for ${customer.id}`);

      let $$ = $({
        env: {
          SUPABASE_ACCESS_TOKEN:
            decrypted_access_token === null
              ? SUPABASE_ACCESS_TOKEN
              : decrypted_access_token,
          SUPABASE_URL: database_url,
          SUPABASE_DB_PASSWORD: decrypted_database_password ?? undefined,
          SUPABASE_PROJECT_ID: project_id ?? undefined,
          SUPABASE_SERVICE_ROLE_KEY: decrypted_service_role_key ?? undefined,
          SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
          SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET,
          SUPABASE_AUTH_EXTERNAL_GOOGLE_REDIRECT_URI,
        },
        cwd: "supabase",
      });

      if (project_id) {
        await $$`supabase link`;
      }

      console.log(`✅ 🐣 Starting migrations for ${customer.id}`);
      if (database_url && database_url.startsWith("postgresql://")) {
        await $$`supabase db push --db-url ${database_url} --include-all`;
      } else {
        await $$`supabase db push --include-all`;
      }

      console.log(`✅ 🐣 Starting deployments for ${customer.id}`);
      if (database_url && database_url.startsWith("postgresql://")) {
        await $$`supabase functions deploy --db-url ${database_url}`;
      } else {
        await $$`supabase functions deploy`;
      }

      if (!customer.seeded) {
        try {
          console.log(`✅ 🌱 Seeding ${customer.id}`);
          await $$`tsx ../../packages/database/src/seed.ts`;
          const { error } = await client
            .from("customer")
            .update({ seeded: true })
            .eq("id", customer.id);

          if (error) {
            throw new Error(
              `🔴 🍳 Failed to mark ${customer.id} as seeded: ${error.message}`
            );
          }

          // TODO: run the seed.sql file
        } catch (e) {
          console.error(`🔴 🍳 Failed to seed ${customer.id}`, e);
        }
      }

      console.log(`✅ 🐓 Successfully migrated ${customer.id}`);
    } catch (error) {
      console.error(`🔴 🍳 Failed to migrate ${customer.id}`, error);
    }
  }
}

migrate();
