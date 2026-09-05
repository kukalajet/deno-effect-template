import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Cause, Option, Predicate, Schema, SchemaIssue } from "effect";
import { SqlError } from "effect/unstable/sql";

// We only need paths; validation messages can include stored values.
const formatValidationIssues = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: () => "",
  checkHook: () => "",
});

const findSqlError = (cause: unknown) => {
  let error = cause;

  if (error instanceof EffectDrizzleQueryError) {
    error = error.cause;
  }
  if (Cause.isCause(error)) {
    error = Option.getOrUndefined(Cause.findErrorOption(error));
  }
  if (!SqlError.isSqlError(error)) return undefined;

  return error;
};

const readDriverCode = (cause: unknown) => {
  if (!Predicate.hasProperty(cause, "code")) return undefined;

  const code = cause.code;
  if (typeof code !== "string") return undefined;

  const isSqlState = /^[A-Z0-9]{5}$/.test(code);
  const isSystemErrorCode = /^E[A-Z0-9_]{1,31}$/.test(code);
  if (!isSqlState && !isSystemErrorCode) return undefined;

  return code;
};

const diagnosticsFromCause = (cause: unknown) => {
  if (Schema.isSchemaError(cause)) {
    const { issues } = formatValidationIssues(cause.issue);
    const validationPaths = issues.map((issue) => {
      const path = issue.path?.map(String).join(".");

      return path || "$";
    });

    return { reason: "SchemaError", validationPaths };
  }

  const error = findSqlError(cause);
  if (error === undefined) return { reason: "UnknownError" };

  // Error messages and stacks can contain SQL parameters or persisted values.
  const reason = error.reason._tag;
  const code = readDriverCode(error.reason.cause);
  if (code === undefined) return { reason };

  return { reason, code };
};

export { diagnosticsFromCause, findSqlError };
