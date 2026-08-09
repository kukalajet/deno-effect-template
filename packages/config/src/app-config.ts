import {
  Config,
  ConfigProvider,
  Context,
  Effect,
  Layer,
  Redacted,
} from "effect";

export const appConfig = Config.all({
  databaseUrl: Config.redacted("DATABASE_URL"),
  apiHost: Config.nonEmptyString("API_HOST").pipe(
    Config.withDefault("127.0.0.1"),
  ),
  apiPort: Config.port("API_PORT").pipe(Config.withDefault(8000)),
});

const environmentVariables = [
  "DATABASE_URL",
  "API_HOST",
  "API_PORT",
] as const;

const liveProvider = Effect.sync(() => {
  const environment: Record<string, string> = {};

  for (const name of environmentVariables) {
    const value = Deno.env.get(name);
    if (value !== undefined) environment[name] = value;
  }

  return ConfigProvider.fromEnv({ env: environment });
});

export class AppConfig extends Context.Service<AppConfig, {
  readonly databaseUrl: Redacted.Redacted<string>;
  readonly apiHost: string;
  readonly apiPort: number;
}>()("@deno-effect/config/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    liveProvider.pipe(
      Effect.flatMap((provider) => appConfig.parse(provider)),
      Effect.map(AppConfig.of),
    ),
  );
}
