import { defineConfig } from "drizzle-kit";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (databaseUrl === undefined) {
  throw new Error("DATABASE_URL is required to run Drizzle Kit");
}

const config = defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./packages/database/src/users/schema.ts",
  dbCredentials: {
    url: databaseUrl,
  },
});

export { config as default };
