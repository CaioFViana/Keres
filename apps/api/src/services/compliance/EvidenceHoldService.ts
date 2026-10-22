import {
  EVIDENCE_HOLD_MAX_DAYS,
  EVIDENCE_HOLD_MAX_NOTE,
  type EvidenceHoldSummary,
  type EvidenceHoldTarget,
} from '@keres/shared/metadata/EvidenceHolds';
import { and, desc, eq, gt, lt } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '@/config/env';
import { db } from '@/db';
import { evidenceHolds, messages, stories, storyPublications, users } from '@/db/schema';
import { trackBackground } from '@/utils/backgroundWork';
import { AppError } from '@/utils/errors';
import { accessRecordService } from './AccessRecordService';
import { StoryExportImportService } from '@/services/stories/StoryExportImportService';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EvidenceHold extends EvidenceHoldSummary {
  /** The item as it was, the subject's account data and the subject's access records, at the moment of the hold. */
  snapshot: unknown;
}

interface CaptureInput {
  targetKind: EvidenceHoldTarget;
  targetId: string;
  reportMessageIds: string[];
  /** The administrator; `null` when the server makes it on a report. */
  createdBy: string | null;
  note?: string | null;
  now?: Date;
}

type HoldRow = typeof evidenceHolds.$inferSelect;

function reportIdsOf(row: HoldRow): string[] {
  return Array.isArray(row.reportMessageIds) ? (row.reportMessageIds as string[]) : [];
}

function summaryOf(row: HoldRow): EvidenceHoldSummary {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    targetKind: row.targetKind,
    targetId: row.targetId,
    subjectUserId: row.subjectUserId,
    reportMessageIds: reportIdsOf(row),
    createdBy: row.createdBy,
    note: row.note,
  };
}

/**
 * Evidence holds (Lei 15.211/2025 art. 27, par. 2; see `evidenceHolds`): a copy of a reported item, and of the
 * data of the person responsible for it, kept for the Marco Civil art. 15 period (`EVIDENCE_HOLD_DAYS`, six months
 * by default) whatever the person does next - delete the item, delete the account.
 *
 * Made by the server when a report of the type `illegal` arrives (the type that covers abuse material), and by an
 * administrator for any other report. Held again for the same item: the earlier hold is renewed and gains the
 * report, not a second copy. An authority's request to keep one longer is `extend`.
 */
export class EvidenceHoldService {
  /**
   * The server's own hold, made after a report of the type `illegal` was filed. Never throws and never makes the
   * report wait: the report is already saved, and a failure here is said on the console for an administrator to
   * redo by hand (the technical log writes through the database too).
   */
  holdForReport(targetKind: EvidenceHoldTarget, targetId: string, reportMessageId: string): void {
    trackBackground(
      this.capture({
        targetKind,
        targetId,
        reportMessageIds: [reportMessageId],
        createdBy: null,
      }).catch((error: unknown) => {
        console.error(`Failed to hold evidence for report ${reportMessageId}`, error);
      }),
    );
  }

  /** An administrator's hold on an item, for any report or none. */
  async createByAdmin(
    adminId: string,
    input: {
      targetKind: EvidenceHoldTarget;
      targetId: string;
      reportMessageId?: string | null;
      note?: string | null;
    },
  ): Promise<EvidenceHoldSummary> {
    return this.capture({
      targetKind: input.targetKind,
      targetId: input.targetId,
      reportMessageIds: input.reportMessageId ? [input.reportMessageId] : [],
      createdBy: adminId,
      note: input.note?.trim().slice(0, EVIDENCE_HOLD_MAX_NOTE) || null,
    });
  }

  async capture(input: CaptureInput): Promise<EvidenceHoldSummary> {
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + env.EVIDENCE_HOLD_DAYS * DAY_MS);

    const existing = await db.query.evidenceHolds.findFirst({
      where: and(
        eq(evidenceHolds.targetKind, input.targetKind),
        eq(evidenceHolds.targetId, input.targetId),
        gt(evidenceHolds.expiresAt, now),
      ),
      orderBy: [desc(evidenceHolds.createdAt)],
    });
    if (existing) {
      const reports = new Set<string>(reportIdsOf(existing));
      for (const id of input.reportMessageIds) reports.add(id);
      const [renewed] = await db
        .update(evidenceHolds)
        .set({
          reportMessageIds: [...reports],
          expiresAt: expiresAt > existing.expiresAt ? expiresAt : existing.expiresAt,
          note: input.note ?? existing.note,
        })
        .where(eq(evidenceHolds.id, existing.id))
        .returning();
      return summaryOf(renewed);
    }

    const { item, subjectUserId } = await this.readItem(input.targetKind, input.targetId);
    const subject = subjectUserId ? await this.readSubject(subjectUserId) : null;
    const [created] = await db
      .insert(evidenceHolds)
      .values({
        id: ulid(),
        createdAt: now,
        expiresAt,
        targetKind: input.targetKind,
        targetId: input.targetId,
        subjectUserId,
        reportMessageIds: input.reportMessageIds,
        createdBy: input.createdBy,
        note: input.note ?? null,
        snapshot: { capturedAt: now.toISOString(), item, subject },
      })
      .returning();
    return summaryOf(created);
  }

  async list(
    limit = 100,
    includeExpired = false,
    now = new Date(),
  ): Promise<EvidenceHoldSummary[]> {
    const rows = await db
      .select()
      .from(evidenceHolds)
      .where(includeExpired ? undefined : gt(evidenceHolds.expiresAt, now))
      .orderBy(desc(evidenceHolds.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));
    return rows.map(summaryOf);
  }

  async get(id: string): Promise<EvidenceHold> {
    const row = await db.query.evidenceHolds.findFirst({ where: eq(evidenceHolds.id, id) });
    if (!row) throw new AppError(404, 'Evidence hold not found.');
    return { ...summaryOf(row), snapshot: row.snapshot };
  }

  /** An authority asked to keep it longer: it now lasts `days` from today, if that is later than it already did. */
  async extend(id: string, days: number, now = new Date()): Promise<EvidenceHoldSummary> {
    if (!Number.isInteger(days) || days < 1 || days > EVIDENCE_HOLD_MAX_DAYS) {
      throw new AppError(400, `Days must be a whole number from 1 to ${EVIDENCE_HOLD_MAX_DAYS}.`);
    }
    const row = await db.query.evidenceHolds.findFirst({ where: eq(evidenceHolds.id, id) });
    if (!row) throw new AppError(404, 'Evidence hold not found.');
    const wanted = new Date(now.getTime() + days * DAY_MS);
    const [updated] = await db
      .update(evidenceHolds)
      .set({ expiresAt: wanted > row.expiresAt ? wanted : row.expiresAt })
      .where(eq(evidenceHolds.id, id))
      .returning();
    return summaryOf(updated);
  }

  /** Lets it go before it expires - the report was unfounded. The administrator's act is on the activity record. */
  async release(id: string): Promise<void> {
    const removed = await db
      .delete(evidenceHolds)
      .where(eq(evidenceHolds.id, id))
      .returning({ id: evidenceHolds.id });
    if (removed.length === 0) throw new AppError(404, 'Evidence hold not found.');
  }

  /** Drops the holds past their end. Returns how many went. */
  async pruneExpired(now = new Date()): Promise<number> {
    const removed = await db
      .delete(evidenceHolds)
      .where(lt(evidenceHolds.expiresAt, now))
      .returning({ id: evidenceHolds.id });
    return removed.length;
  }

  /** The item as the database has it right now, and the account responsible for it. */
  private async readItem(
    kind: EvidenceHoldTarget,
    id: string,
  ): Promise<{ item: unknown; subjectUserId: string | null }> {
    switch (kind) {
      case 'message': {
        const row = await db.query.messages.findFirst({ where: eq(messages.id, id) });
        if (!row) throw new AppError(404, 'Message not found.');
        return { item: { message: row }, subjectUserId: row.senderId };
      }
      case 'user': {
        const row = await db.query.users.findFirst({ where: eq(users.id, id) });
        if (!row) throw new AppError(404, 'User not found.');
        return { item: { user: this.accountOf(row) }, subjectUserId: row.id };
      }
      case 'story': {
        const row = await db.query.stories.findFirst({ where: eq(stories.id, id) });
        if (!row) throw new AppError(404, 'Story not found.');
        return {
          item: { story: row, export: await this.exportStory(id) },
          subjectUserId: row.userId,
        };
      }
      case 'publication': {
        const row = await db.query.storyPublications.findFirst({
          where: eq(storyPublications.id, id),
        });
        if (!row) throw new AppError(404, 'Publication not found.');
        return {
          item: { publication: row, export: await this.exportStory(row.storyId) },
          subjectUserId: row.ownerUserId,
        };
      }
    }
  }

  /** The story with its entities (not its media files). `null` if it cannot be read: the row alone is still kept. */
  private async exportStory(storyId: string): Promise<unknown> {
    try {
      return await new StoryExportImportService().exportStory(storyId);
    } catch (error) {
      console.error(`Evidence hold: could not export story ${storyId}`, error);
      return null;
    }
  }

  private accountOf(row: typeof users.$inferSelect) {
    return {
      id: row.id,
      username: row.username,
      tag: row.tag,
      bio: row.bio,
      profileBiography: row.profileBiography,
      profileLinks: row.profileLinks,
      profileTheme: row.profileTheme,
      avatarColor: row.avatarColor,
      avatarIcon: row.avatarIcon,
      createdAt: row.createdAt,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt,
      verificationStatus: row.verificationStatus,
    };
  }

  /** The data of the person responsible: their account and their sign-in records (the addresses included). */
  private async readSubject(userId: string) {
    const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return {
      userId,
      account: row ? this.accountOf(row) : null,
      accessRecords: await accessRecordService.listOwn(userId),
    };
  }
}

export const evidenceHoldService = new EvidenceHoldService();
