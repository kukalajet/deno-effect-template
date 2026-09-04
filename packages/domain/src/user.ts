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

export const CreateUserSchema = Schema.Struct({
  email: Email,
  displayName: DisplayName,
});
export type CreateUser = typeof CreateUserSchema.Type;

export const UserSchema = Schema.Struct({
  id: UserId,
  email: Email,
  displayName: DisplayName,
  createdAt: Schema.Date,
});
export type User = typeof UserSchema.Type;

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
) {}

export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>()(
  "UserAlreadyExists",
  { email: Email },
) {}
