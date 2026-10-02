import { boolean, table, text, timestampNow } from '../columns';

/**
 * Messages visitors send to the administrators from the landing page (`POST
 * /api/public/contact`). No account needed - hence the contact email. Read and deleted in the
 * admin panel; the server never sends email for them.
 */
export const contactMessages = table('contact_messages', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  contactEmail: text('contact_email').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestampNow('created_at'),
});
