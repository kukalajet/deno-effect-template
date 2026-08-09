import { UserNotFound } from "@deno-effect/domain";
import { desc, eq, sql } from "drizzle-orm";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { Database, DatabaseLive } from "./layer.ts";
import { type CreateUser, type User, users } from "./schema.ts";

const repositoryOperations = [
  "health",
  "insert",
  "findById",
  "list",
] as const;

export class UserRepositoryError
  extends Schema.TaggedError<UserRepositoryError>()("UserRepositoryError", {
    operation: Schema.Literals(repositoryOperations),
    cause: Schema.instanceOf(EffectDrizzleQueryError),
  }) {}

export class UserRepository extends Context.Service<UserRepository, {
  readonly health: Effect.Effect<void, UserRepositoryError>;
  readonly insert: (
    input: CreateUser,
  ) => Effect.Effect<User, UserRepositoryError>;
  readonly findById: (
    id: string,
  ) => Effect.Effect<User, UserNotFound | UserRepositoryError>;
  readonly list: (
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<User>, UserRepositoryError>;
}>()("@deno-effect/database/UserRepository") {}

const makeRepository = Effect.gen(function* () {
  const database = yield* Database;

  const health = database.execute(sql`select 1`).pipe(
    Effect.asVoid,
    Effect.mapError(
      (cause) => new UserRepositoryError({ operation: "health", cause }),
    ),
  );

  const insert = Effect.fn("UserRepository.insert")(
    function* (input: CreateUser) {
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

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  makeRepository,
).pipe(Layer.provide(DatabaseLive));
