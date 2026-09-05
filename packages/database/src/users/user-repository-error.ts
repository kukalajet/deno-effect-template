import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";

import { UserRepositoryError } from "@deno-effect/application";
import { type EmailType, UserAlreadyExists } from "@deno-effect/domain";

import { diagnosticsFromCause, findSqlError } from "../error-diagnostics.ts";

import { userEmailUniqueConstraint } from "./schema.ts";

const toUserRepositoryError = (
  operation: UserRepositoryError["operation"],
  cause: unknown,
) =>
  new UserRepositoryError({
    operation,
    cause,
    diagnostics: diagnosticsFromCause(cause),
  });

const toUserInsertError = (
  email: EmailType,
  cause: EffectDrizzleQueryError,
) => {
  const reason = findSqlError(cause)?.reason;

  if (
    reason?._tag === "UniqueViolation" &&
    reason.constraint === userEmailUniqueConstraint
  ) {
    return new UserAlreadyExists({ email });
  }

  return toUserRepositoryError("insert", cause);
};

export { toUserInsertError, toUserRepositoryError };
