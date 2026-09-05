ARG DENO_VERSION=2.9.6
FROM denoland/deno:${DENO_VERSION}

WORKDIR /app
RUN mkdir -p /deno-dir && chown deno:deno /app /deno-dir
USER deno

COPY --chown=deno:deno deno.json deno.lock .dvmrc ./
COPY --chown=deno:deno apps/api/deno.json ./apps/api/deno.json
COPY --chown=deno:deno apps/worker/deno.json ./apps/worker/deno.json
COPY --chown=deno:deno packages/application/deno.json ./packages/application/deno.json
COPY --chown=deno:deno packages/config/deno.json ./packages/config/deno.json
COPY --chown=deno:deno packages/database/deno.json ./packages/database/deno.json
COPY --chown=deno:deno packages/domain/deno.json ./packages/domain/deno.json
RUN test "$(cat .dvmrc)" = "$(deno eval 'console.log(Deno.version.deno)')" \
    && deno install --frozen --allow-scripts=npm:esbuild

COPY --chown=deno:deno . .
RUN deno task patch:drizzle && deno task check

EXPOSE 8000
STOPSIGNAL SIGINT
CMD ["task", "container:api"]
