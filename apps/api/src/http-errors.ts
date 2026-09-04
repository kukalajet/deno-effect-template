import type { UserRepositoryError } from "@deno-effect/application";
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

export const jsonError = (status: number, code: string, message: string) =>
  HttpServerResponse.jsonUnsafe({ error: { code, message } }, { status });

export const badRequest = () =>
  jsonError(400, "INVALID_REQUEST", "The request payload is invalid");

export const databaseFailure = (error: UserRepositoryError) =>
  Effect.logError("Database operation failed").pipe(
    Effect.annotateLogs({
      errorTag: error._tag,
      operation: error.operation,
    }),
    Effect.as(
      jsonError(
        500,
        "DATABASE_ERROR",
        "The database operation could not be completed",
      ),
    ),
  );

export const healthFailure = (error: UserRepositoryError) =>
  Effect.logError("Database health check failed").pipe(
    Effect.annotateLogs({
      errorTag: error._tag,
      operation: error.operation,
    }),
    Effect.as(
      jsonError(503, "DATABASE_UNAVAILABLE", "The database is unavailable"),
    ),
  );
