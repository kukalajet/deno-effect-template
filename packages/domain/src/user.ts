import { Schema } from "effect";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Email = Schema.Trim.check(
  Schema.isPattern(emailPattern),
  Schema.isMaxLength(320),
);
export type Email = typeof Email.Type;

export const DisplayName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(100),
);
export type DisplayName = typeof DisplayName.Type;

export const UserId = Schema.String.check(Schema.isUUID());
export type UserId = typeof UserId.Type;

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
) {}
