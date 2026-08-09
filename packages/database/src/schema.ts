import { DisplayName, Email, UserId } from "@deno-effect/domain";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_created_at_idx").on(table.createdAt)],
);

export const UserSchema = createSelectSchema(users, {
  id: UserId,
  email: Email,
  displayName: DisplayName,
});

export const UserInsertSchema = createInsertSchema(users, {
  id: UserId,
  email: Email,
  displayName: DisplayName,
});

export const CreateUserSchema = UserInsertSchema.mapFields(
  ({ displayName, email }) => ({ displayName, email }),
);

export type User = typeof UserSchema.Type;
export type CreateUser = typeof CreateUserSchema.Type;
