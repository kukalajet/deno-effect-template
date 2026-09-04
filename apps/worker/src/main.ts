import * as DenoRuntime from "@effect/platform-deno/DenoRuntime";
import { Effect, Layer, Logger } from "effect";

import { AppConfig } from "@deno-effect/config";
import {
  DatabaseLive,
  PgClientLive,
  UserRepositoryPostgresLive,
} from "@deno-effect/database";

import { sampleUsersJob } from "./jobs/sample-users.ts";

const PersistenceLive = UserRepositoryPostgresLive.pipe(
  Layer.provide(DatabaseLive),
  Layer.provide(PgClientLive),
);

const worker = sampleUsersJob.pipe(
  Effect.provide(PersistenceLive),
  Effect.provide(AppConfig.layer),
  Effect.provide(Logger.layer([Logger.consoleJson])),
);

DenoRuntime.runMain(worker);
