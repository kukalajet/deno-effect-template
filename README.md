# Deno Effect backend template

Minimal, production-shaped backend workspace using Deno 2, Effect 4 RC,
PostgreSQL, and Drizzle ORM v1's Effect-native PostgreSQL integration. Docker
Compose runs the API, migrations, and PostgreSQL; the worker runs on demand from
the same application image.

`apps/api` owns the long-running HTTP boundary. `apps/worker` is a finite
process that reuses the same services. Reusable domain rules, application
contracts, configuration, and database adapters live under `packages`.

## Architecture

Packages are split by dependency boundary; code inside each application is
grouped by feature. Routes and worker jobs depend on application contracts,
database adapters implement those contracts, and each executable's `main.ts`
assembles the concrete Effect layers.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the dependency rules, directory
layout, code-placement table, layer composition guidance, and testing examples.

## Prerequisites

- Docker with the Docker Compose plugin
- `curl` and Bash for the smoke checks
- Deno 2.9.6 for optional native development and schema tooling

The image includes Deno, the locked npm dependencies, and the Drizzle patch. No
Node runtime or Deno installation is needed on the VPS.

## Setup

Immediately after creating a repository from this template, initialize its
project identity with a lowercase kebab-case name:

```sh
deno task init my-project
```

If you do not have Deno installed, run the initializer in Docker:

```sh
docker run --rm -v "$PWD:/app" -w /app denoland/deno:2.9.6 \
  run --node-modules-dir=none --allow-read=. --allow-write=. \
  scripts/init-template.ts my-project
```

The initializer updates workspace package scopes, the PostgreSQL database and
credentials, and the PostgreSQL client application name. Run it before making
other changes to the generated repository.

Start the stack:

```sh
cp .env.example .env
docker compose up -d --build --wait
docker compose ps
```

The build runs formatting, lint, type checks, and unit/API tests. Compose waits
for PostgreSQL, applies the migrations, and starts the API. The database uses a
named volume, so recreating containers preserves its data. `docker compose down`
stops the stack and preserves that volume; adding `--volumes` deletes its data.

Compose builds the internal connection URL from `POSTGRES_USER`,
`POSTGRES_PASSWORD`, and `POSTGRES_DB`. Use URL-safe credentials, such as a hex
password. `DATABASE_URL` in `.env` is only for native Deno tooling. The API
listens on `0.0.0.0:8000` inside its container and is published on
`127.0.0.1:${API_PORT:-8000}` on the host.

The automatically loaded `docker-compose.override.yml` publishes PostgreSQL on
loopback port `5432` for local tools. Set `POSTGRES_PORT` to change that host
port. Production loads only `docker-compose.yml`, which keeps PostgreSQL
private.

## Applications

The API provides:

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

Run the one-shot worker and view API logs:

```sh
docker compose run --rm worker
docker compose logs -f api
```

The worker logs a small user sample, releases the PostgreSQL pool, and exits. It
is a profile-gated service, so ordinary `docker compose up` does not run it.

After changing code, rebuild and update the stack:

```sh
docker compose up -d --build --wait
```

For native watch mode, run `deno task setup`, keep only PostgreSQL running in
Compose, and use `deno task dev:api` or `deno task dev:worker`. Ensure the
native `DATABASE_URL` matches the database's published port and the task's
network allowlist. The default example uses `5432` throughout.

## Automatic VPS deployment

GitHub Actions builds and tests the image on pull requests. Successful pushes to
`main` publish an image to `ghcr.io/<owner>/<repository>:sha-<commit>`,
supporting both Linux amd64 and arm64. The build uses the Deno version in
`.dvmrc`; keep the Dockerfile's default version aligned when updating it.

The optional deploy job sends Compose configuration over SSH and deploys that
image by its immutable digest. The VPS pulls the image, runs migrations, and
updates the API. Failed activation restores the previous image and Compose
configuration. PostgreSQL data stays in its existing volume.

Deployment stays disabled until the repository variable `VPS_DEPLOY_ENABLED` is
set to `true` and the VPS connection settings are configured. Follow
[the VPS setup guide](./deploy/README.md) to prepare Docker and registry access.

## Migrations and Studio

The committed initial migration is the source of truth. To generate migrations
from schema changes, use the native Deno tools:

```sh
deno task setup
deno task db:generate --name=describe-change
deno task db:check
```

Rebuild the image and apply the committed migrations through Compose:

```sh
docker compose build
docker compose run --rm migrate
docker compose up -d --wait
```

Launch Studio with `deno task db:studio` against the local database port. The
Drizzle tasks intentionally use `-A`; the API and worker use explicit
environment and network allowlists. Container commands use the `postgresql:5432`
service address and receive environment values from Compose.

## Quality checks

The Docker build runs the checks, and the smoke script exercises the actual API,
migrations, PostgreSQL adapter, worker, and persistent database volume:

```sh
docker build -t deno-effect-template:local .
bash scripts/smoke-docker.sh
```

The smoke script creates an isolated Compose project with an ephemeral API port
and deletes only its own test containers and volume when finished. CI runs the
same script before publishing.

For native checks:

```sh
deno task fmt
deno task lint
deno task lint:anti-slop
deno task typecheck
deno task test
deno task check
```

`deno task lint` runs Deno's recommended rules followed by the curated Anti-slop
profile; use `lint:anti-slop` to run that second pass directly.
`deno task check` runs formatting, both lint passes, workspace type checking,
and all unit/API tests in sequence and stops on the first failure.

The Anti-slop profile orders imports as Node built-ins, external dependencies,
workspace packages, parent modules, then sibling modules, and requires explicit
export lists at the bottom of each file. It also requires a blank line before a
return that follows another statement in the same block or switch case.
Side-effect imports remain in place as ordering barriers. The profile also
rejects chained assertions, widening followed by an assertion, undocumented
non-const assertions, unsafe dictionary value types, module mocking, and
importing Effect `make*` service constructors into runtime code. The Effect rule
recognizes both relative imports and this workspace's `@deno-effect/*` aliases.
Known-value widening is initially a warning. The selected upstream rules are
vendored at commit `e8c4880`; other broader stylistic rules remain disabled.

## Exact dependency policy

- Deno `2.9.6`
- `effect@4.0.0-rc.112`
- `@effect/platform-deno@4.0.0-rc.112`
- `@effect/sql-pg@4.0.0-rc.112`
- `oxlint@1.81.0`
- `@oxlint/plugins@1.81.0`
- `drizzle-orm@1.0.0-rc.4`
- `drizzle-kit@1.0.0-rc.4`
- `pg@8.23.0`
- `@types/pg@8.23.1`
- `postgres:18.6-alpine`

The three Effect packages are pinned to the same RC; mixing Effect 4 prerelease
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

Drizzle Kit's launcher and Oxlint's native binding require a local npm
dependency tree, so `nodeModulesDir` is set to `auto`. The application and
quality checks still run through Deno and do not use `npx` or `bunx`. On Linux,
the Oxlint task also permits reading `/usr/bin/ldd` so its native binding can
detect the system's libc implementation.

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
