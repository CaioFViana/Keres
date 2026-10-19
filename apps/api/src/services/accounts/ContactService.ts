import type { ContactCreate } from '@keres/shared';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { env } from '@/config/env';
import { newMessageId } from '@/services/messages/MessageService';

/**
 * The landing page form. What a visitor writes lands in `messages` as a `site` message: no user on
 * either side, and the address they left to be answered at. The administrators handle it in the same
 * inbox as the messages users send from the client (`AdminMessageService`).
 */
export class ContactService {
  async create(input: ContactCreate) {
    const [created] = await db
      .insert(messages)
      .values({
        id: newMessageId(),
        channel: 'site',
        subject: input.subject,
        body: input.body,
        contactEmail: input.contactEmail,
        // Nobody on the sender's side to delete it: the administrators removing it removes the row.
        senderDeletedAt: new Date(),
      })
      .returning();
    return created;
  }

  /**
   * Drops landing-page messages older than the retention: a visitor's address is kept only
   * while the conversation may still be alive. Returns how many went.
   */
  async pruneSiteMessages(
    now = new Date(),
    days = env.CONTACT_MESSAGE_RETENTION_DAYS,
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60_000);
    const dropped = await db
      .delete(messages)
      .where(and(eq(messages.channel, 'site'), lt(messages.createdAt, cutoff)))
      .returning({ id: messages.id });
    return dropped.length;
  }
}

export const contactService = new ContactService();
