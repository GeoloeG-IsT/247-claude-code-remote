import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const machines = pgTable('machines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tunnelUrl: text('tunnel_url'), // Optional - not used in v0
  status: text('status').default('offline').notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  config: jsonb('config').$type<{
    projects: string[];
    agentUrl?: string; // e.g., "localhost:4678" or "mac.tailnet.ts.net:4678"
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  machineId: text('machine_id')
    .references(() => machines.id)
    .notNull(),
  project: text('project'),
  status: text('status').default('running').notNull(),
  tmuxSession: text('tmux_session'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Type exports
export type Machine = typeof machines.$inferSelect;
export type NewMachine = typeof machines.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
