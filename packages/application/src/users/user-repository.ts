import {
  type CreateUser,
  type User,
  UserAlreadyExists,
  type UserIdType,
  UserNotFound,
} from "@deno-effect/domain";
import { Context, Effect, Schema } from "effect";

const repositoryOperations = [
  "health",
  "insert",
  "findById",
  "list",
] as const;

class UserRepositoryError
  extends Schema.TaggedError<UserRepositoryError>()("UserRepositoryError", {
    operation: Schema.Literals(repositoryOperations),
    cause: Schema.Defect(),
  }) {}

class UserRepository extends Context.Service<UserRepository, {
  readonly health: Effect.Effect<void, UserRepositoryError>;
  readonly insert: (
    input: CreateUser,
  ) => Effect.Effect<User, UserAlreadyExists | UserRepositoryError>;
  readonly findById: (
    id: UserIdType,
  ) => Effect.Effect<User, UserNotFound | UserRepositoryError>;
  readonly list: (
    limit?: number,
  ) => Effect.Effect<ReadonlyArray<User>, UserRepositoryError>;
}>()("@deno-effect/application/UserRepository") {}

export { UserRepository, UserRepositoryError };
