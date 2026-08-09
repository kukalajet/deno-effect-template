import {
  CreateUserSchema,
  UserRepository,
  type UserRepositoryError,
} from "@deno-effect/database";
import { UserId } from "@deno-effect/domain";
import { Effect, Schema } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

const jsonError = (status: number, code: string, message: string) =>
  HttpServerResponse.jsonUnsafe({ error: { code, message } }, { status });

const badRequest = () =>
  jsonError(400, "INVALID_REQUEST", "The request payload is invalid");

const databaseFailure = (error: UserRepositoryError) =>
  Effect.logError("Database operation failed").pipe(
    Effect.annotateLogs({
      errorTag: error._tag,
      operation: error.operation,
    }),
    Effect.as(
      jsonError(
        500,
        "DATABASE_ERROR",
        "The database operation could not be completed",
      ),
    ),
  );

const healthFailure = (error: UserRepositoryError) =>
  Effect.logError("Database health check failed").pipe(
    Effect.annotateLogs({
      errorTag: error._tag,
      operation: error.operation,
    }),
    Effect.as(
      jsonError(503, "DATABASE_UNAVAILABLE", "The database is unavailable"),
    ),
  );

const health = Effect.gen(function* () {
  const repository = yield* UserRepository;
  yield* repository.health;
  return HttpServerResponse.jsonUnsafe({ status: "ok", database: "ok" });
}).pipe(Effect.catchTag("UserRepositoryError", healthFailure));

const listUsers = Effect.gen(function* () {
  const repository = yield* UserRepository;
  const users = yield* repository.list();
  return HttpServerResponse.jsonUnsafe({ users });
}).pipe(Effect.catchTag("UserRepositoryError", databaseFailure));

const findUser = Effect.gen(function* () {
  const { id } = yield* HttpRouter.schemaPathParams(
    Schema.Struct({ id: UserId }),
  );
  const repository = yield* UserRepository;
  const user = yield* repository.findById(id);
  return HttpServerResponse.jsonUnsafe(user);
}).pipe(
  Effect.catchTags({
    SchemaError: () => Effect.succeed(badRequest()),
    UserNotFound: () =>
      Effect.succeed(jsonError(404, "USER_NOT_FOUND", "User not found")),
    UserRepositoryError: databaseFailure,
  }),
);

const createUser = Effect.gen(function* () {
  const input = yield* HttpServerRequest.schemaBodyJson(CreateUserSchema);
  const repository = yield* UserRepository;
  const user = yield* repository.insert(input);
  return HttpServerResponse.jsonUnsafe(user, { status: 201 });
}).pipe(
  Effect.catchTags({
    HttpServerError: () => Effect.succeed(badRequest()),
    SchemaError: () => Effect.succeed(badRequest()),
    UserRepositoryError: databaseFailure,
  }),
);

export const ApiRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", "/health", health),
  HttpRouter.route("GET", "/users", listUsers),
  HttpRouter.route("GET", "/users/:id", findUser),
  HttpRouter.route("POST", "/users", createUser),
]);
