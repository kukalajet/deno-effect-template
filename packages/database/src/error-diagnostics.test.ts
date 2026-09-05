import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Cause, Effect, Schema } from "effect";
import { SqlError } from "effect/unstable/sql";

import { diagnosticsFromCause } from "./error-diagnostics.ts";

for (
  const { code, reason } of [
    { code: "42501", reason: SqlError.AuthorizationError },
    { code: "ECONNREFUSED", reason: SqlError.UnknownError },
  ]
) {
  Deno.test(`database diagnostics retain ${code} without query or driver data`, () => {
    const driverCause = Object.assign(new Error("secret driver message"), {
      code,
      detail: "secret row detail",
    });
    const sqlReason = new reason({ cause: driverCause });
    const cause = new EffectDrizzleQueryError({
      query: "select 'secret SQL'",
      params: ["secret parameter"],
      cause: Cause.fail(new SqlError.SqlError({ reason: sqlReason })),
    });
    const diagnostics = diagnosticsFromCause(cause);

    deepStrictEqual(diagnostics, { reason: sqlReason._tag, code });
    strictEqual(JSON.stringify(diagnostics).includes("secret"), false);
  });
}

Deno.test("database diagnostics omit unrecognized causes and unsafe codes", () => {
  const cause = Object.assign(new Error("secret error message"), {
    _tag: "secret category",
    code: "secret driver code",
  });
  deepStrictEqual(diagnosticsFromCause(cause), { reason: "UnknownError" });

  const diagnostics = diagnosticsFromCause(
    new SqlError.SqlError({
      reason: new SqlError.ConnectionError({ cause }),
    }),
  );
  deepStrictEqual(diagnostics, { reason: "ConnectionError" });
});

Deno.test("validation diagnostics contain paths without reported input", async () => {
  const cause = await Effect.runPromise(
    Schema.decodeUnknownEffect(Schema.Struct({ count: Schema.Number }))({
      count: "secret invalid count",
    }, { reportInput: true }).pipe(Effect.flip),
  );
  const diagnostics = diagnosticsFromCause(cause);

  strictEqual(cause.message.includes("secret invalid count"), true);
  deepStrictEqual(diagnostics, {
    reason: "SchemaError",
    validationPaths: ["count"],
  });
  strictEqual(JSON.stringify(diagnostics).includes("secret"), false);
});
