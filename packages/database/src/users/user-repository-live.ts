import { UserRepository, UserRepositoryError } from "@deno-effect/application";
import { UserNotFound } from "@deno-effect/domain";
import { desc, eq, sql } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";
import { Database } from "../postgres.ts";
import { users } from "./schema.ts";

const makeUserRepository = Effect.gen(function* () {
  const database = yield* Database;

  const health = database.execute(sql`select 1`).pipe(
    Effect.asVoid,
    Effect.mapError(
      (cause) => new UserRepositoryError({ operation: "health", cause }),
    ),
  );

  const insert = Effect.fn("UserRepository.insert")(
    function* (input) {
      const rows = yield* database.insert(users).values(input).returning();
      return rows[0]!;
    },
    Effect.mapError(
      (cause) => new UserRepositoryError({ operation: "insert", cause }),
    ),
  );

  const findById = Effect.fn("UserRepository.findById")(function* (id: string) {
    const rows = yield* database
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .pipe(
        Effect.mapError(
          (cause) => new UserRepositoryError({ operation: "findById", cause }),
        ),
      );
    const user = Option.fromUndefinedOr(rows[0]);

    if (Option.isNone(user)) {
      return yield* new UserNotFound({ id });
    }

    return user.value;
  });

  const list = Effect.fn("UserRepository.list")(
    function* (limit?: number) {
      const query = database.select().from(users).orderBy(
        desc(users.createdAt),
      );
      return yield* limit === undefined ? query : query.limit(limit);
    },
    Effect.mapError(
      (cause) => new UserRepositoryError({ operation: "list", cause }),
    ),
  );

  return UserRepository.of({ health, insert, findById, list });
});

export const UserRepositoryPostgresLive = Layer.effect(
  UserRepository,
  makeUserRepository,
);
