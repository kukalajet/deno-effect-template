import { desc, eq, sql } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";

import { UserRepository } from "@deno-effect/application";
import { UserNotFound } from "@deno-effect/domain";

import { Database } from "../postgres.ts";

import { UserRowSchema, users } from "./schema.ts";
import {
  toUserInsertError,
  toUserRepositoryError,
} from "./user-repository-error.ts";

const decodeUserRow = Schema.decodeUnknownEffect(UserRowSchema);
const decodeUserRows = Schema.decodeUnknownEffect(Schema.Array(UserRowSchema));

const makeUserRepository = Effect.gen(function* () {
  const database = yield* Database;

  const health = database.execute(sql`select 1`).pipe(
    Effect.asVoid,
    Effect.mapError(
      (cause) => toUserRepositoryError("health", cause),
    ),
  );

  const insert = Effect.fn("UserRepository.insert")(
    function* (input) {
      const rows = yield* database.insert(users).values(input).returning().pipe(
        Effect.mapError((cause) => toUserInsertError(input.email, cause)),
      );

      return yield* decodeUserRow(rows[0]).pipe(
        Effect.mapError(
          (cause) => toUserRepositoryError("insert", cause),
        ),
      );
    },
  );

  const findById = Effect.fn("UserRepository.findById")(function* (id: string) {
    const rows = yield* database
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .pipe(
        Effect.mapError(
          (cause) => toUserRepositoryError("findById", cause),
        ),
      );
    const user = Option.fromUndefinedOr(rows[0]);

    if (Option.isNone(user)) {
      return yield* new UserNotFound({ id });
    }

    return yield* decodeUserRow(user.value).pipe(
      Effect.mapError(
        (cause) => toUserRepositoryError("findById", cause),
      ),
    );
  });

  const list = Effect.fn("UserRepository.list")(
    function* (limit?: number) {
      const query = database.select().from(users).orderBy(
        desc(users.createdAt),
      );

      const rows = yield* limit === undefined ? query : query.limit(limit);

      return yield* decodeUserRows(rows);
    },
    Effect.mapError(
      (cause) => toUserRepositoryError("list", cause),
    ),
  );

  return UserRepository.of({ health, insert, findById, list });
});

const UserRepositoryPostgresLive = Layer.effect(
  UserRepository,
  makeUserRepository,
);

export { UserRepositoryPostgresLive };
