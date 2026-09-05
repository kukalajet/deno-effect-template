import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { PgClient } from "@effect/sql-pg";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Cause, Effect, Layer, Schema, Stream } from "effect";
import { SqlConnection, SqlError } from "effect/unstable/sql";

import { UserRepository } from "@deno-effect/application";

import { DatabaseLive } from "../postgres.ts";

import { toUserInsertError } from "./user-repository-error.ts";
import { UserRepositoryPostgresLive } from "./user-repository-live.ts";

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

const repositoryWithRows = (rows: ReadonlyArray<ReadonlyArray<unknown>>) => {
  const unexpectedQuery = Effect.die(
    new Error("Unexpected SQL execution mode"),
  );
  const connection: SqlConnection.Connection = {
    execute: () => unexpectedQuery,
    executeRaw: () => unexpectedQuery,
    executeStream: () => Stream.fromEffect(unexpectedQuery),
    executeValues: () => Effect.succeed(rows),
    executeValuesUnprepared: () => unexpectedQuery,
    executeUnprepared: () => unexpectedQuery,
  };
  const acquirer = Effect.succeed(connection);
  const client = PgClient.layerFrom(PgClient.makeWith({
    acquirer,
    transactionAcquirer: acquirer,
    listenAcquirer: unexpectedQuery,
    config: {},
  }));

  return UserRepositoryPostgresLive.pipe(
    Layer.provide(DatabaseLive),
    Layer.provide(client),
  );
};

const user = {
  id: "d5b9d3de-fda5-4a78-b8a5-2f3b60634d95",
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  createdAt: new Date("2026-08-09T12:00:00.000Z"),
};
const input = { email: user.email, displayName: user.displayName };
const storedRow = [
  user.id,
  "  ada@example.com  ",
  "  Ada Lovelace  ",
  user.createdAt.toISOString(),
];
for (const operation of ["insert", "findById", "list"] as const) {
  const run = Effect.gen(function* () {
    const repository = yield* UserRepository;
    if (operation === "insert") return [yield* repository.insert(input)];
    if (operation === "findById") return [yield* repository.findById(user.id)];

    return yield* repository.list();
  });

  Deno.test(`${operation} decodes and normalizes persisted rows`, async () => {
    const result = await Effect.runPromise(
      run.pipe(Effect.provide(repositoryWithRows([storedRow]))),
    );

    deepStrictEqual(result, [user]);
  });

  for (
    const { field, path, row } of [
      {
        field: "email",
        path: "email",
        row: [
          user.id,
          "not-an-email",
          user.displayName,
          user.createdAt.toISOString(),
        ],
      },
      {
        field: "display name",
        path: "displayName",
        row: [user.id, user.email, "   ", user.createdAt.toISOString()],
      },
    ]
  ) {
    Deno.test(`${operation} rejects an invalid persisted ${field}`, async () => {
      const rows = operation === "list" ? [storedRow, row] : [row];
      const failure = await Effect.runPromise(
        run.pipe(Effect.flip, Effect.provide(repositoryWithRows(rows))),
      );

      strictEqual(failure._tag, "UserRepositoryError");
      if (failure._tag === "UserRepositoryError") {
        strictEqual(failure.operation, operation);
        strictEqual(Schema.isSchemaError(failure.cause), true);
        deepStrictEqual(failure.diagnostics, {
          reason: "SchemaError",
          validationPaths: [operation === "list" ? `1.${path}` : path],
        });
      }
    });
  }
}

Deno.test("findById preserves UserNotFound for a missing row", async () => {
  const failure = await Effect.runPromise(
    UserRepository.use((repository) => repository.findById(user.id)).pipe(
      Effect.flip,
      Effect.provide(repositoryWithRows([])),
    ),
  );

  strictEqual(failure._tag, "UserNotFound");
  if (failure._tag === "UserNotFound") {
    strictEqual(failure.id, user.id);
  }
});

Deno.test("list preserves an empty result", async () => {
  const result = await Effect.runPromise(
    UserRepository.use((repository) => repository.list()).pipe(
      Effect.provide(repositoryWithRows([])),
    ),
  );

  deepStrictEqual(result, []);
});
