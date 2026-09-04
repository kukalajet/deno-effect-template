import { strictEqual } from "node:assert/strict";

import { ConfigProvider, Effect, Exit } from "effect";

import { appConfig } from "@deno-effect/config";

Deno.test("configuration fails when DATABASE_URL is missing", () => {
  const provider = ConfigProvider.fromUnknown({});
  const exit = Effect.runSyncExit(appConfig.parse(provider));

  strictEqual(Exit.isFailure(exit), true);
});
