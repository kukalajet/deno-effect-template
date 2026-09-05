# Deploy with Docker Compose over SSH

GitHub Actions builds and tests the application image. Successful pushes to
`main` publish `ghcr.io/<owner>/<repository>:sha-<commit>` for Linux amd64 and
arm64. Deployment to your VPS is opt-in and uses the published image's immutable
digest. The VPS runs Docker; Deno, npm dependencies, and the Drizzle patch live
in the image.

The API, migration command, and finite worker share that image. PostgreSQL runs
from its pinned official image with a persistent named volume. Only the API is
published on loopback; your existing HTTPS reverse proxy forwards traffic to it.

## Prepare the VPS once

Install Docker Engine and the Docker Compose plugin, plus Bash, tar, gzip, and
`flock` (from util-linux). Enable Docker to start on boot. The SSH account must
be able to run Docker commands; Docker group membership grants root-equivalent
control of the host. The examples below use an existing account named `deploy`.

Run the template initializer before using these paths. On the VPS:

```sh
sudo install -d -o deploy -g deploy -m 750 /srv/deno-effect-template
sudo -u deploy touch /srv/deno-effect-template/.env
sudo chmod 600 /srv/deno-effect-template/.env
sudo -u deploy nano /srv/deno-effect-template/.env
```

Populate this file with your production settings:

```dotenv
POSTGRES_DB=deno_effect
POSTGRES_USER=deno_effect
POSTGRES_PASSWORD=replace_with_a_generated_hex_password
API_PORT=8000
```

Generate a URL-safe password with `openssl rand -hex 32`. Compose constructs the
internal database URL using these values, so avoid URI-reserved characters in
the credentials. They stay on the VPS and are never bundled into the image or
sent to GitHub. Changing the password in this file does not change an existing
database role's password; database credential rotation is a separate operation.

Configure your existing HTTPS reverse proxy to forward to `127.0.0.1:8000` (or
the host port chosen in `API_PORT`). There is no app systemd unit to install.

The VPS requires outbound access to GHCR and Docker Hub. For a private GHCR
package, log in **as the same account used by SSH deployment**:

```sh
docker login ghcr.io --username YOUR_GITHUB_USER
```

At the password prompt, supply a GitHub personal access token (classic) with
`read:packages` and access to this package. Docker stores the registry
credentials for future pulls. Public packages can be pulled without login. CI
uses its own short-lived `GITHUB_TOKEN` to publish; that token is not copied to
the VPS.

Add the deployment public SSH key to the account's `~/.ssh/authorized_keys` and
verify key-based access. The workflow uses a dedicated key without a passphrase.

## Configure GitHub

Create an environment named `production`. Under repository **Settings →
Environments → production**, add:

| Kind     | Name              | Value                                               |
| -------- | ----------------- | --------------------------------------------------- |
| Variable | `VPS_HOST`        | VPS hostname or IP address                          |
| Variable | `VPS_USER`        | SSH account with Docker access                      |
| Variable | `VPS_PORT`        | SSH port; defaults to `22`                          |
| Secret   | `VPS_SSH_KEY`     | Deployment private key, including header and footer |
| Secret   | `VPS_KNOWN_HOSTS` | Verified OpenSSH known-hosts entry for this VPS     |

Use a known-hosts entry from a trusted connection after verifying the
fingerprint through your VPS console/provider. A nonstandard port uses
`[hostname]:port` in the entry. The workflow verifies this stored host key on
every connection.

When the VPS is ready, add **repository-level** Actions variable
`VPS_DEPLOY_ENABLED=true` under **Settings → Secrets and variables → Actions →
Variables**. It must be a repository variable because the job condition is
checked before environment variables are loaded. Leaving it unset still runs CI
and publishes images from `main`, but skips SSH deployment.

You can also trigger the workflow manually on `main`. Pull requests never
publish images or deploy. The first package publication is normally private;
grant your VPS login account read access, or explicitly make the package public
if intended.

## Deployment sequence

1. Build the image, including the locked install, Drizzle patch, and quality
   checks.
2. Run the Docker smoke checks against real PostgreSQL: create/read/conflict,
   timestamp conversion, worker exit, repeat migrations, and volume persistence.
3. Publish the versioned image for amd64 and arm64.
4. Upload only `docker-compose.yml` to a versioned VPS configuration directory
   and record the image digest beside it in `image.env`.
5. Pull the image, start PostgreSQL if needed, and run migrations in a temporary
   container. Existing database containers are not recreated by app deployments.
6. Replace the API container and wait for its `/health` check. On success,
   update the `current` configuration link. On failure, restore the previous
   image and Compose configuration; on a failed first deployment, stop the API.

The deployment script always uses the project name `deno-effect-template`, so
its `postgres_data` volume survives changes to configuration directory or image.
It loads the base Compose file explicitly; the local database-port override is
never uploaded or used. The script never deletes database volumes.

Deployments are serialized and protected by a VPS lock. API replacement briefly
interrupts requests. Rollback restores application code and configuration only;
it does not reverse database migrations. Use migrations compatible with the
running and previous image versions, and back up data before destructive
changes.

## Operations

As the SSH account, use the current deployment configuration:

```sh
cd /srv/deno-effect-template/current
docker compose -p deno-effect-template \
  --env-file /srv/deno-effect-template/.env --env-file image.env \
  -f docker-compose.yml logs -f api
```

With the same options, use `run --rm --no-deps worker` to run the worker, or
`ps` to inspect the stack. The worker is not scheduled automatically.

Back up PostgreSQL independently of application releases. Keep the project name
and volume name stable. Do not run `down --volumes` on production. Updating the
PostgreSQL image or major version is a separate database maintenance operation.
Keep previous app images and their configuration directories available for
rollback; avoid pruning them until they are no longer needed.

The workflow does not provision a domain, TLS, or off-server backups.

References: [Compose in production][compose],
[GHCR authentication and image digests][ghcr], [Docker volumes][volumes].

[compose]: https://docs.docker.com/compose/how-tos/production/
[ghcr]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
[volumes]: https://docs.docker.com/engine/storage/volumes/
