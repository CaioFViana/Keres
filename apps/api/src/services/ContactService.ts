import type { ContactCreate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { contactMessages } from '../db/schema';

export class ContactNotFoundError extends Error {
  constructor() {
    super('Contact message not found.');
    this.name = 'ContactNotFoundError';
  }
}

export class ContactService {
  async create(input: ContactCreate) {
    const [created] = await db
      .insert(contactMessages)
      .values({ id: ulid(), ...input })
      .returning();
    return created;
  }

  async list() {
    return db.query.contactMessages.findMany({
      orderBy: (m, { desc: descending }) => [descending(m.createdAt)],
    });
  }

  /**
   * Reading a message marks it read: the admin list shows what still needs attention, and
   * opening the detail is the acknowledgement. There is no separate "mark read" action.
   */
  async getAndMarkRead(id: string) {
    const existing = await db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, id),
    });
    if (!existing) {
      throw new ContactNotFoundError();
    }
    if (existing.isRead) {
      return existing;
    }
    const [updated] = await db
      .update(contactMessages)
      .set({ isRead: true })
      .where(eq(contactMessages.id, id))
      .returning();
    return updated;
  }

  /** Physical deletion: a handled message leaves no tombstone behind. */
  async remove(id: string) {
    const [deleted] = await db
      .delete(contactMessages)
      .where(eq(contactMessages.id, id))
      .returning({ id: contactMessages.id });
    if (!deleted) {
      throw new ContactNotFoundError();
    }
    return deleted;
  }
}

export const contactService = new ContactService();
