import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const couples = sqliteTable('couples', {
    id: text('id').primaryKey(), name: text('name').notNull(), since: text('since'), inviteHash: text('invite_hash').notNull(), inviteExpires: integer('invite_expires').notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('invite_unique').on(t.inviteHash)]);
export const members = sqliteTable('members', {
    userId: text('user_id').primaryKey(), coupleId: text('couple_id').notNull().references(() => couples.id), slot: integer('slot').notNull(), name: text('name').notNull(), mood: text('mood').notNull().default(''),
}, t => [uniqueIndex('two_people_only').on(t.coupleId, t.slot)]);
export const records = sqliteTable('records', {
    id: text('id').primaryKey(), coupleId: text('couple_id').notNull().references(() => couples.id), kind: text('kind').notNull(), data: text('data').notNull(), creator: text('creator').notNull(), version: integer('version').notNull().default(1), createdAt: integer('created_at').notNull(),
});
export const locations = sqliteTable('locations', {
    userId: text('user_id').primaryKey().references(() => members.userId), coupleId: text('couple_id').notNull().references(() => couples.id), latitude: text('latitude').notNull(), longitude: text('longitude').notNull(), accuracy: integer('accuracy').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const limits = sqliteTable('rate_limits', { id: text('id').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull() });
