import { UserRepository } from "@deno-effect/application";
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { healthFailure } from "../http-errors.ts";

const health = Effect.gen(function* () {
  const repository = yield* UserRepository;
  yield* repository.health;
  return HttpServerResponse.jsonUnsafe({ status: "ok", database: "ok" });
}).pipe(Effect.catchTag("UserRepositoryError", healthFailure));

export const HealthRoutes = HttpRouter.add("GET", "/health", health);
