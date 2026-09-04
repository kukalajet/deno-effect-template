import { Schema } from "effect";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Email = Schema.Trim.check(
  Schema.isPattern(emailPattern),
  Schema.isMaxLength(320),
);
type Email = typeof Email.Type;

const DisplayName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(100),
);
type DisplayName = typeof DisplayName.Type;

const UserId = Schema.String.check(Schema.isUUID());
type UserId = typeof UserId.Type;

const CreateUserSchema = Schema.Struct({
  email: Email,
  displayName: DisplayName,
});
type CreateUser = typeof CreateUserSchema.Type;

const UserSchema = Schema.Struct({
  id: UserId,
  email: Email,
  displayName: DisplayName,
  createdAt: Schema.Date,
});
type User = typeof UserSchema.Type;

class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: UserId },
) {}

class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>()(
  "UserAlreadyExists",
  { email: Email },
) {}

export {
  type CreateUser,
  CreateUserSchema,
  DisplayName,
  Email,
  type User,
  UserAlreadyExists,
  UserId,
  UserNotFound,
  UserSchema,
};
