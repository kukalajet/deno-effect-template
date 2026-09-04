import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer } from "effect";
import { types } from "pg";

import { AppConfig } from "@deno-effect/config";

const rawDrizzleTypeIds = new Set([
  1082,
  1114,
  1115,
  1182,
  1184,
  1185,
  1186,
  1187,
  1231,
]);

const PgClientLive = Layer.unwrap(
  AppConfig.pipe(
    Effect.map((config) =>
      PgClient.layer({
        url: config.databaseUrl,
        applicationName: "deno-effect-template",
        connectTimeout: "5 seconds",
        maxConnections: 10,
        types: {
          getTypeParser: (typeId, format) =>
            rawDrizzleTypeIds.has(typeId)
              ? (value: string) => value
              : types.getTypeParser(typeId, format),
        },
      })
    ),
  ),
);

const databaseEffect = PgDrizzle.makeWithDefaults();

class Database extends Context.Service<
  Database,
  Effect.Success<typeof databaseEffect>
>()("@deno-effect/database/Database") {}

const DatabaseLive = Layer.effect(Database, databaseEffect);

export { Database, DatabaseLive, PgClientLive };
