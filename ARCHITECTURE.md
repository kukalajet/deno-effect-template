# Architecture and code placement

This workspace is organized by **architectural boundary** at the package level
and by **feature** inside each application. The goal is to make dependencies
visible: application code declares what it needs, adapters implement those
contracts, and each executable chooses the concrete implementations in
`main.ts`.

## Dependency direction

Arrows mean "may import":

```text
API routes -----------+
                      +--> application --> domain
worker jobs ----------+

database adapters --------> application + domain
database infrastructure --> config

apps/*/main.ts --> routes or jobs + database + config
```

The rules behind the diagram are more important than the exact folders:

- `domain` has no dependency on another workspace package. It owns business
  values, entities, invariants, and domain errors.
- `application` depends on `domain`. It owns use cases and contracts (ports)
  such as `UserRepository`, but no PostgreSQL, HTTP, or Deno runtime code.
- `database` is an outbound adapter. It depends on application contracts and
  domain types, and owns PostgreSQL, Drizzle, tables, row mappings, and live
  repository implementations.
- `config` owns validated environment configuration. It contains no business or
  transport logic.
- API route modules and worker job modules depend on `application` and `domain`,
  not on concrete database implementations.
- An app's `main.ts` is its **composition root**. It may import every layer it
  needs because its job is to select implementations, assemble the layer graph,
  configure logging, and launch the runtime.

## Intended layout

```text
apps/
  api/src/
    main.ts                         # production wiring and server launch
    app.ts                          # combines route groups
    http-errors.ts                  # HTTP errors shared by route groups
    health/
      routes.ts
    users/
      routes.ts
      routes.test.ts
  worker/src/
    main.ts                         # production wiring and process launch
    jobs/
      sample-users.ts

packages/
  domain/
    mod.ts                          # public package API
    src/user.ts                     # domain values, models, and errors
  application/
    mod.ts
    src/users/user-repository.ts    # abstract service/port
  database/
    mod.ts
    src/postgres.ts                 # PgClient and Database services/layers
    src/users/schema.ts             # Drizzle table and row schemas
    src/users/user-repository-live.ts
  config/
    mod.ts
    src/app-config.ts
```

This is a guide, not a requirement to pre-create every possible file. Keep a
small feature in one cohesive file until splitting it gives the code a clearer
owner.

## Package or folder?

Create a package when code represents a dependency boundary with its own public
API or when it must be reused by more than one executable. For example, the
repository contract belongs in `application`, while its PostgreSQL
implementation belongs in `database`.

Create a feature folder inside an existing app or package when the code has the
same boundary and runtime dependencies as its neighbors. A new API feature
normally starts at `apps/api/src/<feature>/routes.ts`; it does not need a new
workspace package.

Do not create a package merely because a file became long. First split the file
by responsibility within its existing boundary. Conversely, do not put reusable
business rules in an app-level `utils.ts` just because only one caller exists
today; ownership, rather than line count, decides the location.

## Where new code goes

| Code being added                                                           | Location                              |
| -------------------------------------------------------------------------- | ------------------------------------- |
| HTTP method, path, headers, request decoding, or response status           | `apps/api/src/<feature>/`             |
| Route groups shared by the API                                             | combined in `apps/api/src/app.ts`     |
| HTTP error/response helper used by multiple route groups                   | `apps/api/src/http-errors.ts`         |
| Worker trigger, schedule behavior, or one-shot job                         | `apps/worker/src/jobs/`               |
| Business value, invariant, entity, command, or domain error                | `packages/domain/src/<feature>.ts`    |
| Use-case orchestration or outbound service contract                        | `packages/application/src/<feature>/` |
| PostgreSQL/Drizzle table, query, row mapping, or repository implementation | `packages/database/src/<feature>/`    |
| Shared PostgreSQL client or Drizzle service                                | `packages/database/src/postgres.ts`   |
| Environment variable parsing, validation, or defaults                      | `packages/config/src/`                |
| Production layer selection and process startup                             | the executable's `main.ts`            |
| A fake service for a test                                                  | beside the consuming test             |

If a use case coordinates several ports or enforces an application workflow,
give it a named module in `application`. If it only calls one repository method
and returns the result unchanged, let the route or job use the repository
directly; a forwarding `UserService` adds no boundary.

## Effect services and layers

Keep the contract, implementation, composition, and test replacement separate:

1. Define the `Context.Service` contract in `application`, using domain inputs,
   outputs, and expected errors. The contract must not mention Drizzle or a
   concrete database error type.
2. Define its production `Layer` beside the adapter that implements it. For
   example, `UserRepositoryPostgresLive` lives in `database` and requires
   `Database`.
3. Keep each live layer's requirements visible. `UserRepositoryPostgresLive`
   requires `Database`, `DatabaseLive` requires `PgClient`, and `PgClientLive`
   requires `AppConfig`; none silently installs the next layer in the chain.
4. Connect that chain in `main.ts`, then provide configuration and logging at
   the outside edge:

   ```ts
   const PersistenceLive = UserRepositoryPostgresLive.pipe(
     Layer.provide(DatabaseLive),
     Layer.provide(PgClientLive),
   );
   ```

5. In a consumer test, replace the contract directly with `Layer.succeed`. Route
   and job unit tests should not start PostgreSQL or import a live database
   adapter. Test the adapter separately when database integration behavior is
   the subject of the test.

Choose the layer combinator by the relationship being expressed:

| Combinator           | Use it when                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Layer.provide`      | One layer satisfies another layer's requirement. The provider's services are internal to the result.          |
| `Layer.mergeAll`     | Layers are siblings whose outputs are all needed; it does not express that one supplies another.              |
| `Layer.provideMerge` | A provider satisfies a requirement and its service must deliberately remain available in the resulting layer. |

Prefer `provide` for an implementation chain. Use `mergeAll` for independent
capabilities, and use `provideMerge` only when downstream code genuinely needs
both the higher-level service and the lower-level provider. This keeps
infrastructure such as `Database` from leaking into ordinary consumers.

## Schemas belong to their boundary

- Domain schemas describe business-valid data (`Email`, `UserId`,
  `CreateUserSchema`, `UserSchema`) and live in `domain`.
- HTTP schemas describe transport-only shapes such as path parameters, query
  strings, headers, and envelopes. They live with the route. Reuse domain
  schemas inside them instead of duplicating business constraints.
- Drizzle tables and generated select/insert row schemas describe persistence.
  They live in `database` and are not the public business model.
- Configuration schemas describe environment input and live in `config`.

Crossing a boundary should be explicit. Map a database row or transport value to
the domain representation when their shapes or semantics differ. Do not derive
the public application model from a Drizzle table, and do not make an API
consumer import database schema code to validate a request.

## Public imports

Each package exposes its supported surface through `mod.ts` and its `deno.json`
export. Code in another package imports that surface:

```ts
import { UserRepository } from "@deno-effect/application";
```

Do not deep-import another package's `src/` files. Relative imports are for
modules inside the same package or app. Keep adapter-only details out of
`mod.ts` unless another boundary, such as an app composition root, intentionally
needs them.

## Guardrails against accidental architecture

- Group code by feature within a boundary; avoid global `controllers/`,
  `services/`, and `repositories/` buckets in the apps.
- Add an interface or service contract at a real boundary, not for every
  function.
- Do not add a use-case class that merely forwards arguments.
- Do not create a global `AppLive` imported by every executable. Each executable
  owns its runtime graph and may choose different adapters.
- Keep handlers private to `routes.ts` until another module has a real need for
  them.
- Prefer a feature-local helper over a generic `shared` or `utils` module. Move
  it only after its ownership is genuinely shared.
- Avoid exposing `Database`, SQL, or Drizzle types to routes and jobs.
- Add folders and files as responsibilities appear; the layout is not a quota to
  fill.
