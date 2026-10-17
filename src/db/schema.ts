import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color").default("#6366f1"),
  coverUrl: text("cover_url"),
  coverColor: text("cover_color").default("#0f172a"),
  bio: text("bio").default(""),
  website: text("website"),
  socials: text("socials").default("{}"),
  appPin: text("app_pin"),
  masterSecret: text("master_secret"),
  allowScreenshot: boolean("allow_screenshot").notNull().default(true),
  allowDownload: boolean("allow_download").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  friendId: integer("friend_id").notNull(),
  status: text("status").notNull().default("accepted"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaItems = pgTable("media_items", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  kind: text("kind").notNull().default("image"),
  title: text("title"),
  url: text("url").notNull(),
  visibility: text("visibility").notNull().default("public"),
  allowedIds: text("allowed_ids").default("[]"),
  allowDownload: boolean("allow_download"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("private"),
  title: text("title").notNull(),
  description: text("description").default(""),
  avatarColor: text("avatar_color").default("#0ea5e9"),
  creatorId: integer("creator_id").notNull(),
  inviteCode: text("invite_code"),
  requireApproval: boolean("require_approval").notNull().default(true),
  spamEnabled: boolean("spam_enabled").notNull().default(true),
  spamWindow: integer("spam_window").notNull().default(60),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMembers = pgTable("chat_members", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  customRoleId: integer("custom_role_id"),
  status: text("status").notNull().default("member"),
  mutedUntil: timestamp("muted_until"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const customRoles = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(20),
  permissions: text("permissions").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  senderId: integer("sender_id").notNull(),
  kind: text("kind").notNull().default("text"),
  content: text("content").default(""),
  mediaUrl: text("media_url"),
  mediaKind: text("media_kind"),
  replyTo: integer("reply_to"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  chatId: integer("chat_id").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  userId: integer("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatSecrets = pgTable("chat_secrets", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  secretWord: text("secret_word").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
