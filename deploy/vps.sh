#!/usr/bin/env bash
set -euo pipefail

release_id=${1:?Usage: vps.sh <commit>-<run-id>-<attempt> <image-digest>}
image_ref=${2:?An immutable GHCR image digest is required}
if [[ ! "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "Invalid release identifier" >&2
  exit 1
fi
if [[ ! "$image_ref" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]; then
  echo "Expected a GHCR image pinned by sha256 digest" >&2
  exit 1
fi

app_dir=/srv/deno-effect-template
project=deno-effect-template
release_dir="$app_dir/releases/$release_id"
archive="$HOME/release-$release_id.tar.gz"

test -r "$app_dir/.env"
docker compose version > /dev/null
exec 9>"$app_dir/.deploy.lock"
if ! flock -n 9; then
  echo "Another deployment is running" >&2
  exit 1
fi
trap 'rm -f "$archive"' EXIT

mkdir -p "$app_dir/releases"
mkdir "$release_dir"
tar -xzf "$archive" --no-same-owner -C "$release_dir"
printf 'APP_IMAGE=%s\n' "$image_ref" > "$release_dir/image.env"

compose() {
  directory=$1
  shift
  env -u APP_IMAGE docker compose -p "$project" \
    --env-file "$app_dir/.env" --env-file "$directory/image.env" \
    -f "$directory/docker-compose.yml" "$@"
}

compose "$release_dir" config --quiet
compose "$release_dir" pull api
# App deployments must not recreate or upgrade an existing database container.
compose "$release_dir" up -d --no-recreate --wait --wait-timeout 90 postgresql
compose "$release_dir" run --rm --no-deps --pull never migrate

previous_release=$(readlink "$app_dir/current" || true)
if compose "$release_dir" up -d --no-build --no-deps --pull never \
  --wait --wait-timeout 90 api; then
  ln -sfn "$release_dir" "$app_dir/current.next"
  mv -Tf "$app_dir/current.next" "$app_dir/current"
  echo "Deployed $image_ref"
  exit 0
fi

echo "API activation failed; restoring the previous image and Compose configuration" >&2
if [[ -n "$previous_release" ]]; then
  compose "$previous_release" up -d --no-build --no-deps --pull never \
    --wait --wait-timeout 90 api
else
  compose "$release_dir" stop api
fi
exit 1
