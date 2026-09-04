import { UserRepository } from "@deno-effect/application";
import { CreateUserSchema, UserId } from "@deno-effect/domain";
import { Effect, Schema } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { badRequest, databaseFailure, jsonError } from "../http-errors.ts";

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
    UserAlreadyExists: () =>
      Effect.succeed(
        jsonError(
          409,
          "USER_ALREADY_EXISTS",
          "A user with this email already exists",
        ),
      ),
    UserRepositoryError: databaseFailure,
  }),
);

export const UserRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", "/users", listUsers),
  HttpRouter.route("GET", "/users/:id", findUser),
  HttpRouter.route("POST", "/users", createUser),
]);
