import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { strictEqual } from "node:assert/strict";
import { Cause } from "effect";
import { SqlError } from "effect/unstable/sql";
import { toUserInsertError } from "./user-repository-live.ts";

const uniqueViolation = (constraint: string) =>
  new EffectDrizzleQueryError({
    query: "insert into users",
    params: [],
    cause: Cause.fail(
      new SqlError.SqlError({
        reason: new SqlError.UniqueViolation({
          cause: new Error("duplicate key"),
          constraint,
        }),
      }),
    ),
  });

Deno.test("maps only the users email constraint to UserAlreadyExists", () => {
  const conflict = toUserInsertError(
    "ada@example.com",
    uniqueViolation("users_email_key"),
  );
  strictEqual(conflict._tag, "UserAlreadyExists");
  if (conflict._tag === "UserAlreadyExists") {
    strictEqual(conflict.email, "ada@example.com");
  }

  const failure = toUserInsertError(
    "ada@example.com",
    uniqueViolation("other_constraint"),
  );
  strictEqual(failure._tag, "UserRepositoryError");
  if (failure._tag === "UserRepositoryError") {
    strictEqual(failure.operation, "insert");
  }
});
