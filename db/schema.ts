import { pgTable, text, integer, index, primaryKey } from 'drizzle-orm/pg-core';
export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    data: text('data').notNull(),
    updated: text('updated').notNull(),
  },
  (t) => [index('idx_workspaces_owner').on(t.owner)],
);
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    workspace: text('workspace').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    size: integer('size').notNull(),
    parts: integer('parts').notNull(),
    state: text('state').notNull().default('pending'),
  },
  (t) => [index('idx_documents_owner_workspace').on(t.owner, t.workspace)],
);
export const chunks = pgTable(
  'document_chunks',
  {
    document: text('document')
      .notNull()
      .references(() => documents.id),
    part: integer('part').notNull(),
    data: text('data').notNull(),
  },
  (t) => [primaryKey({ columns: [t.document, t.part] })],
);
export const limits = pgTable('request_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
});
