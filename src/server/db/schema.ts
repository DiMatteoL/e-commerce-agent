import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `e-commerce-agent_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .default(sql`CURRENT_TIMESTAMP`),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  chats: many(chats),
  googleAnalyticsAccounts: many(googleAnalyticsAccounts),
  googleAnalyticsProperties: many(googleAnalyticsProperties),
}));

export const chats = createTable(
  "chat",
  (d) => ({
    id: d.text().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "cascade" }),
    payload: d.jsonb(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("chat_user_id_idx").on(t.userId)],
);

export const chatsRelations = relations(chats, ({ one }) => ({
  user: one(users, { fields: [chats.userId], references: [users.id] }),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Google Analytics onboarding storage
export const googleAnalyticsAccounts = createTable(
  "google_analytics_account",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountResourceName: d.text().notNull(), // e.g. accounts/123456
    accountDisplayName: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("ga_account_user_idx").on(t.userId),
    index("ga_account_resource_idx").on(t.accountResourceName),
  ],
);

export const googleAnalyticsAccountsRelations = relations(
  googleAnalyticsAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [googleAnalyticsAccounts.userId],
      references: [users.id],
    }),
    properties: many(googleAnalyticsProperties),
  }),
);

export const googleAnalyticsProperties = createTable(
  "google_analytics_property",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: d
      .integer()
      .notNull()
      .references(() => googleAnalyticsAccounts.id, { onDelete: "cascade" }),
    propertyResourceName: d.text().notNull(), // e.g. properties/987654321
    propertyId: d.varchar({ length: 64 }),
    propertyDisplayName: d.varchar({ length: 255 }),
    selected: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("ga_property_user_idx").on(t.userId),
    index("ga_property_account_idx").on(t.accountId),
    index("ga_property_resource_idx").on(t.propertyResourceName),
    uniqueIndex("ga_property_selected_unique_per_user")
      .on(t.userId)
      .where(sql`${t.selected} = true`),
  ],
);

export const googleAnalyticsPropertiesRelations = relations(
  googleAnalyticsProperties,
  ({ one }) => ({
    user: one(users, {
      fields: [googleAnalyticsProperties.userId],
      references: [users.id],
    }),
    account: one(googleAnalyticsAccounts, {
      fields: [googleAnalyticsProperties.accountId],
      references: [googleAnalyticsAccounts.id],
    }),
  }),
);
