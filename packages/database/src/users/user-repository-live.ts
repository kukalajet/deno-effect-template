import { UserRepository, UserRepositoryError } from "@deno-effect/application";
import {
  type EmailType,
  UserAlreadyExists,
  UserNotFound,
} from "@deno-effect/domain";
import { desc, eq, sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Cause, Effect, Layer, Option } from "effect";
import { SqlError } from "effect/unstable/sql";
import { Database } from "../postgres.ts";
import { userEmailUniqueConstraint, users } from "./schema.ts";

const isUserEmailConflict = (
  error: EffectDrizzleQueryError,
): boolean => {
  if (!Cause.isCause(error.cause)) return false;

  const failure = Cause.findErrorOption(error.cause);
  if (Option.isNone(failure) || !SqlError.isSqlError(failure.value)) {
    return false;
  }

  const reason = failure.value.reason;
  return reason._tag === "UniqueViolation" &&
    reason.constraint === userEmailUniqueConstraint;
};

const toUserInsertError = (
  email: EmailType,
  cause: EffectDrizzleQueryError,
) =>
  isUserEmailConflict(cause)
    ? new UserAlreadyExists({ email })
    : new UserRepositoryError({ operation: "insert", cause });

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
      const rows = yield* database.insert(users).values(input).returning().pipe(
        Effect.mapError((cause) => toUserInsertError(input.email, cause)),
      );
      return rows[0]!;
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

const UserRepositoryPostgresLive = Layer.effect(
  UserRepository,
  makeUserRepository,
);

export { toUserInsertError, UserRepositoryPostgresLive };
