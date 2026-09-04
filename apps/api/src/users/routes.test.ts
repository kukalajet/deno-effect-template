import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { UserRepository } from "@deno-effect/application";
import {
  type User,
  UserAlreadyExists,
  UserNotFound,
} from "@deno-effect/domain";

import { ApiRoutes } from "../app.ts";

const userId = "d5b9d3de-fda5-4a78-b8a5-2f3b60634d95";
const createdAt = new Date("2026-08-09T12:00:00.000Z");

const user: User = {
  id: userId,
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  createdAt,
};

const userRepositoryTest = UserRepository.of({
  health: Effect.void,
  insert: (input) => Effect.succeed({ ...user, ...input }),
  findById: (id) =>
    id === userId
      ? Effect.succeed(user)
      : Effect.fail(new UserNotFound({ id })),
  list: () => Effect.succeed([user]),
});

const UserRepositoryTest = Layer.succeed(UserRepository, userRepositoryTest);

const UserRepositoryConflictTest = Layer.succeed(
  UserRepository,
  UserRepository.of({
    ...userRepositoryTest,
    insert: (input) =>
      Effect.fail(new UserAlreadyExists({ email: input.email })),
  }),
);

const TestRoutes = ApiRoutes.pipe(
  HttpRouter.provideRequest(UserRepositoryTest),
);

Deno.test("GET /users uses a UserRepository test Layer", async () => {
  const { dispose, handler } = HttpRouter.toWebHandler(TestRoutes, {
    disableLogger: true,
  });

  try {
    const response = await handler(new Request("http://localhost/users"));

    strictEqual(response.status, 200);
    deepStrictEqual(await response.json(), {
      users: [{ ...user, createdAt: createdAt.toISOString() }],
    });
  } finally {
    await dispose();
  }
});

Deno.test("POST /users rejects schema-invalid input", async () => {
  const { dispose, handler } = HttpRouter.toWebHandler(TestRoutes, {
    disableLogger: true,
  });

  try {
    const response = await handler(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", displayName: "" }),
      }),
    );

    strictEqual(response.status, 400);
    deepStrictEqual(await response.json(), {
      error: {
        code: "INVALID_REQUEST",
        message: "The request payload is invalid",
      },
    });
  } finally {
    await dispose();
  }
});

Deno.test("POST /users maps an existing email to a conflict", async () => {
  const routes = ApiRoutes.pipe(
    HttpRouter.provideRequest(UserRepositoryConflictTest),
  );
  const { dispose, handler } = HttpRouter.toWebHandler(routes, {
    disableLogger: true,
  });

  try {
    const response = await handler(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          displayName: "Ada Lovelace",
        }),
      }),
    );

    strictEqual(response.status, 409);
    deepStrictEqual(await response.json(), {
      error: {
        code: "USER_ALREADY_EXISTS",
        message: "A user with this email already exists",
      },
    });
  } finally {
    await dispose();
  }
});
