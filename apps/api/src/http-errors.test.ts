import {
  deepStrictEqual,
  doesNotMatch,
  ok,
  strictEqual,
} from "node:assert/strict";

import { Effect, Logger } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

import { UserRepositoryError } from "@deno-effect/application";

import { databaseFailure, healthFailure } from "./http-errors.ts";

for (
  const testCase of [
    {
      name: "databaseFailure",
      handler: databaseFailure,
      operation: "list",
      diagnostics: { reason: "SchemaError", validationPaths: ["email"] },
      status: 500,
      code: "DATABASE_ERROR",
      message: "The database operation could not be completed",
      logMessage: "Database operation failed",
    },
    {
      name: "healthFailure",
      handler: healthFailure,
      operation: "health",
      diagnostics: { reason: "PermissionDenied", code: "42501" },
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "The database is unavailable",
      logMessage: "Database health check failed",
    },
  ] as const
) {
  Deno.test(`${testCase.name} logs safe diagnostics and keeps the response generic`, async () => {
    const lines: Array<string> = [];
    const logger = Logger.map(Logger.formatJson, (line) => lines.push(line));
    const cause = Object.assign(new Error("SECRET_SENTINEL"), {
      query: "select SQL_SENTINEL",
      params: ["PARAM_SENTINEL"],
    });
    const error = new UserRepositoryError({
      operation: testCase.operation,
      cause,
      diagnostics: testCase.diagnostics,
    });
    const response = HttpServerResponse.toWeb(
      await Effect.runPromise(
        testCase.handler(error).pipe(Effect.provide(Logger.layer([logger]))),
      ),
    );

    strictEqual(lines.length, 1);
    const [line] = lines;
    ok(line);
    const log = JSON.parse(line);
    strictEqual(log.level, "ERROR");
    strictEqual(log.message, testCase.logMessage);
    strictEqual(log.cause, undefined);
    deepStrictEqual(log.annotations, {
      errorTag: "UserRepositoryError",
      operation: testCase.operation,
      diagnostics: testCase.diagnostics,
    });
    doesNotMatch(line, /SECRET_SENTINEL|SQL_SENTINEL|PARAM_SENTINEL/);
    strictEqual(response.status, testCase.status);
    deepStrictEqual(await response.json(), {
      error: { code: testCase.code, message: testCase.message },
    });
  });
}
