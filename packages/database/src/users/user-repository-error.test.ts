import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { SqlError } from "effect/unstable/sql";

import { toUserRepositoryError } from "./user-repository-error.ts";

Deno.test("user repository errors retain operation, cause, and safe diagnostics", () => {
  const cause = new SqlError.SqlError({
    reason: new SqlError.AuthorizationError({
      cause: Object.assign(new Error("permission denied"), { code: "42501" }),
    }),
  });
  const failure = toUserRepositoryError("findById", cause);

  strictEqual(failure.operation, "findById");
  strictEqual(failure.cause, cause);
  deepStrictEqual(failure.diagnostics, {
    reason: "AuthorizationError",
    code: "42501",
  });
});
