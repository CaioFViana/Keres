import type { ContactCreate } from '@keres/shared';
import { db } from '../db';
import { messages } from '../db/schema';
import { newMessageId } from './MessageService';

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
}

export const contactService = new ContactService();
