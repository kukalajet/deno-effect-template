import * as DenoRuntime from "@effect/platform-deno/DenoRuntime";
import { AppConfig } from "@deno-effect/config";
import { UserRepository, UserRepositoryLive } from "@deno-effect/database";
import { Effect, Logger } from "effect";

const worker = Effect.gen(function* () {
  yield* AppConfig;
  const repository = yield* UserRepository;
  const users = yield* repository.list(5);

  yield* Effect.logInfo("Worker user sample loaded").pipe(
    Effect.annotateLogs({ userCount: users.length }),
  );
}).pipe(
  Effect.annotateLogs({ service: "worker" }),
  Effect.tapError((error) =>
    Effect.logError("Worker failed").pipe(
      Effect.annotateLogs({
        errorTag: error._tag,
        operation: error.operation,
      }),
    )
  ),
  Effect.provide(UserRepositoryLive),
  Effect.provide(AppConfig.layer),
  Effect.provide(Logger.layer([Logger.consoleJson])),
);

DenoRuntime.runMain(worker);
