import { UserRepository } from "@deno-effect/application";
import { Effect } from "effect";

const sampleUsersJob = Effect.gen(function* () {
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
);

export { sampleUsersJob };
