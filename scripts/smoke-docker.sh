#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export APP_IMAGE=${APP_IMAGE:-deno-effect-template:local}
export POSTGRES_DB=smoke_test POSTGRES_USER=smoke_test POSTGRES_PASSWORD=smoke_test
export API_PORT=0 COMPOSE_PROFILES=
project="deno-effect-smoke-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
compose=(docker compose --env-file .env.example -f docker-compose.yml -p "$project")

cleanup() {
  status=$?
  if [[ "$status" != 0 ]]; then
    "${compose[@]}" logs --no-color
  fi
  "${compose[@]}" down --volumes --remove-orphans
  exit "$status"
}
trap cleanup EXIT

"${compose[@]}" up -d --no-build --wait --wait-timeout 120
address=$("${compose[@]}" port api 8000)
curl --fail --silent --show-error "http://$address/health"
"${compose[@]}" exec -T api deno run --no-prompt --allow-net=127.0.0.1:8000 \
  scripts/smoke-api.ts
"${compose[@]}" run --rm --no-deps worker
"${compose[@]}" run --rm --no-deps migrate

# Recreate both containers to verify that the named database volume preserves data.
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 90 postgresql
"${compose[@]}" up -d --no-build --no-deps --force-recreate --wait --wait-timeout 90 api
address=$("${compose[@]}" port api 8000)
curl --fail --silent --show-error "http://$address/users" | grep -F 'ada@example.com'
echo "Docker smoke checks passed, including persistent data and worker exit"
