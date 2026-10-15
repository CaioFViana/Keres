import { STORY_DELETION_GRACE_DAYS } from '@keres/shared';
import { and, asc, eq, isNull, like, lt, or } from 'drizzle-orm';
import { db, withWriteTransaction } from '@/db';
import { stories, users } from '@/db/schema';
import { logger } from '@/utils/logger';
import { purgeStoryData } from './StoryPurgeService';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Stories erased per run: the rest wait for the next day, so one run never holds the database for long. */
const MAX_STORIES_PER_RUN = 200;

export interface StoryRetentionOutcome {
  /** Stories deleted by their owner more than the grace ago. */
  deleted: number;
  /** Stories whose owner's account has been erased. */
  orphaned: number;
  /** Stories that could not be erased this time; the next run tries again. */
  failed: number;
}

/**
 * The retention of stories on the server (the privacy policy's "until deletion + 30 days"): a story deleted more than
 * `STORY_DELETION_GRACE_DAYS` ago, and a story whose owner's account has been erased, are removed with everything that
 * belongs to them - entities, operation history, comments, permissions, publications. Without this the history of
 * stories nobody can reach any more is most of what the database holds.
 *
 * The story row goes too. Nothing needs it afterwards: pulling or pushing a missing story answers 404 exactly as it
 * does for a deleted one, which is what makes a collaborator's device unlink it, and the owner who sends the story again
 * is no longer asked about "the old data still kept here". Media files are not touched (they are stored by content, and
 * the media sweep drops the ones no story uses).
 *
 * An owner's account is erased once its grace is over (`UserService.pruneDeletedAccounts`), and this job runs right after
 * it, so a deleted account's stories go the same day its personal data does. A story that is still being reached through
 * an account that is only *deleted* (inside its own grace) stays: the person may come back.
 */
export class StoryRetentionService {
  async purgeExpired(now: Date = new Date()): Promise<StoryRetentionOutcome> {
    const cutoff = new Date(now.getTime() - STORY_DELETION_GRACE_DAYS * DAY_MS);

    const deleted = await db
      .select({ id: stories.id })
      .from(stories)
      .where(
        and(
          eq(stories.isDeleted, true),
          // A row marked deleted without a date (older data) counts from the last time it changed.
          or(
            lt(stories.deletedAt, cutoff),
            and(isNull(stories.deletedAt), lt(stories.updatedAt, cutoff)),
          ),
        ),
      )
      .orderBy(asc(stories.updatedAt))
      .limit(MAX_STORIES_PER_RUN);

    // The scrub of an erased account is `deleted:<id>` (see `UserService.eraseAccount`).
    const orphaned = await db
      .select({ id: stories.id })
      .from(stories)
      .innerJoin(users, eq(users.id, stories.userId))
      .where(like(users.username, 'deleted:%'))
      .orderBy(asc(stories.updatedAt))
      .limit(MAX_STORIES_PER_RUN);

    const outcome: StoryRetentionOutcome = { deleted: 0, orphaned: 0, failed: 0 };
    const done = new Set<string>();
    const queue = [
      ...deleted.map((row) => ({ id: row.id, kind: 'deleted' as const })),
      ...orphaned.map((row) => ({ id: row.id, kind: 'orphaned' as const })),
    ].slice(0, MAX_STORIES_PER_RUN);
    for (const { id, kind } of queue) {
      if (done.has(id)) continue;
      done.add(id);
      try {
        await withWriteTransaction((tx) => purgeStoryData(tx, id));
        outcome[kind] += 1;
      } catch (error) {
        // One story that cannot be erased (something outside it still points into it) must not hold back the rest.
        outcome.failed += 1;
        logger.error(`Story retention: could not erase story ${id}`, error);
      }
    }
    return outcome;
  }
}

export const storyRetentionService = new StoryRetentionService();
