import * as DenoHttpServer from "@effect/platform-deno/DenoHttpServer";
import * as DenoRuntime from "@effect/platform-deno/DenoRuntime";
import { AppConfig } from "@deno-effect/config";
import {
  DatabaseLive,
  PgClientLive,
  UserRepositoryPostgresLive,
} from "@deno-effect/database";
import { Effect, Layer, Logger } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { ApiRoutes } from "./app.ts";

const PersistenceLive = UserRepositoryPostgresLive.pipe(
  Layer.provide(DatabaseLive),
  Layer.provide(PgClientLive),
);

const HttpServerLive = Layer.unwrap(
  AppConfig.pipe(
    Effect.map((config) =>
      DenoHttpServer.layer({
        hostname: config.apiHost,
        port: config.apiPort,
        gracefulShutdownTimeout: "10 seconds",
      })
    ),
  ),
);

const ServerLive = HttpRouter.serve(
  ApiRoutes.pipe(HttpRouter.provideRequest(PersistenceLive)),
).pipe(
  Layer.provide(HttpServerLive),
  Layer.provide(AppConfig.layer),
);

const main = Layer.launch(ServerLive).pipe(
  Effect.provide(Logger.layer([Logger.consoleJson])),
);

DenoRuntime.runMain(main);
