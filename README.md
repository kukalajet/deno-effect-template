# Deno Effect backend template

Minimal, production-shaped backend workspace using Deno 2, Effect 4 Beta,
PostgreSQL, and Drizzle ORM v1's Effect-native PostgreSQL integration.

`apps/api` owns the long-running HTTP boundary. `apps/worker` is a finite
process that reuses the same services. Configuration, domain validation, and
database infrastructure live under `packages`, keeping reusable code outside
either executable.

## Prerequisites

- Deno 2.9.5
- Docker with Docker Compose
- `curl` for the examples

No `package.json`, Node runtime, global Drizzle installation, or dotenv package
is required.

## Setup

```sh
cp .env.example .env
deno task setup
docker compose up -d --wait postgresql
docker compose ps
deno task db:migrate
```

`deno task setup` installs the locked npm dependencies, permits only esbuild's
trusted install script, and applies the temporary Drizzle compatibility patch
described below.

## Applications

Start the API in watch mode:

```sh
deno task dev:api
```

The non-watch production-shaped command is `deno task start:api`. The API
provides:

```text
GET  /health
GET  /users
GET  /users/:id
POST /users
```

Exercise it from another terminal:

```sh
curl -fsS http://127.0.0.1:8000/health
curl -fsS -X POST http://127.0.0.1:8000/users \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","displayName":"Ada Lovelace"}'
curl -fsS http://127.0.0.1:8000/users
```

Run the one-shot worker:

```sh
deno task start:worker
```

The worker acquires the same scoped PostgreSQL/Drizzle Layers, logs a small user
sample as structured JSON, releases the pool, and exits.

## Migrations and Studio

The committed initial migration is the source of truth. After changing the
Drizzle schema, generate, validate, and apply a new migration with:

```sh
deno task db:generate --name=describe-change
deno task db:check
deno task db:migrate
```

Launch Studio through its native Deno task:

```sh
deno task db:studio
```

Open the local Studio URL printed by the command. Drizzle tooling is
intentionally run with `-A`; the API and worker use explicit environment and
network allowlists.

## Quality checks

```sh
deno task fmt
deno task lint
deno task typecheck
deno task test
deno task check
```

`deno task check` runs formatting, linting, workspace type checking, and all
unit/API tests in sequence and stops on the first failure.

## Exact dependency policy

- Deno `2.9.5`
- `effect@4.0.0-beta.106`
- `@effect/platform-deno@4.0.0-beta.106`
- `@effect/sql-pg@4.0.0-beta.106`
- `drizzle-orm@1.0.0-rc.4`
- `drizzle-kit@1.0.0-rc.4`
- `pg@8.23.0`
- `@types/pg@8.21.0`
- `postgres:18.4-alpine`

The three Effect packages are pinned to the same beta; mixing Effect 4 beta
levels is unsupported. Drizzle ORM and Kit use the same stable RC. The lockfile
is committed so indirect npm resolution is reproducible.

## Prerelease and Deno interoperability notes

There is currently no unpatched published version set for this exact stack.
Drizzle RC4 still calls `Schema.TaggedErrorClass`, which Effect removed in
beta.104, while the Effect 4 line of `@effect/platform-deno` begins at beta.104.
Drizzle's unpublished RC5 branch performs the same constructor rename to
`Schema.TaggedError`.

For that reason, `scripts/patch-drizzle.ts` makes only that upstream-equivalent
rename in the installed, ignored `node_modules` runtime files. It is idempotent
and fails closed if the expected package signature changes. Remove the script
and the `patch:drizzle` setup step as soon as a compatible Drizzle release is
published. See the upstream [RC5 fix][drizzle-fix].

Drizzle Kit's native Deno launcher requires a local npm dependency tree, so
`nodeModulesDir` is set to `auto`. This is the only reason `node_modules` is
enabled. The application still runs natively on Deno and does not use `npx` or
`bunx`.

The node-postgres compatibility layer probes several optional `PG*` variables,
which explains the read-only environment names in the application tasks. An open
[node-postgres Deno latency report][pg-deno-issue] concerns older Deno/pg
versions; repeat-query latency should be smoke-tested whenever either pin
changes.

Deno 2.9 currently prints an informational legacy `request.signal` warning on
the first HTTP response through the Effect Deno server. The project does not opt
into an unstable Deno flag; scoped SIGINT shutdown was verified successfully.

[drizzle-fix]: https://github.com/drizzle-team/drizzle-orm/commit/b1b6cf140288df1976131794763d67e9d5847a74
[pg-deno-issue]: https://github.com/brianc/node-postgres/issues/3679
