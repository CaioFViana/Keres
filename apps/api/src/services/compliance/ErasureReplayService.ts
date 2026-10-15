import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { type ErasureLedger, erasureLedger } from './ErasureLedger';
import { userService } from '@/services/accounts/UserService';

export interface ErasureReplayOutcome {
  /** Accounts the database had back as active that the ledger says were deleted. */
  redeleted: number;
  /** Accounts whose personal data the database had back that the ledger says were erased. */
  reerased: number;
  /** Accounts the database had deleted that the ledger says an administrator restored. */
  restored: number;
}

/**
 * Applies the erasure ledger to the database in front of it, so that a restored backup cannot bring back what was
 * erased after the dump (see `ErasureLedger`). It runs at every boot and is idempotent: on a database that is up
 * to date it finds nothing to do and changes nothing. Only the LAST event of each account counts, so an
 * administrator's restoration after a deletion is honoured.
 *
 * An account the ledger names that the database does not have (it was never in the dump, or was removed for
 * good) is skipped. Dates are the ledger's own, so a re-deleted account's grace period keeps counting from the
 * day the person actually asked.
 */
export async function applyErasureLedger(
  ledger: ErasureLedger = erasureLedger,
): Promise<ErasureReplayOutcome> {
  const outcome: ErasureReplayOutcome = { redeleted: 0, reerased: 0, restored: 0 };
  for (const entry of ledger.latestPerUser()) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, entry.userId),
      columns: { id: true, isDeleted: true, username: true },
    });
    if (!user) continue;
    const scrubbed = user.username.startsWith('deleted:');

    if (entry.kind === 'account_restored') {
      // An erased account cannot be brought back: only a still-deactivated one is.
      if (user.isDeleted && !scrubbed) {
        await db
          .update(users)
          .set({ isDeleted: false, deletedAt: null, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        outcome.restored += 1;
      }
      continue;
    }

    if (!user.isDeleted) {
      await db
        .update(users)
        .set({ isDeleted: true, deletedAt: new Date(entry.at), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      outcome.redeleted += 1;
    }
    if (entry.kind === 'account_erased' && !scrubbed) {
      await userService.eraseAccount(user.id);
      outcome.reerased += 1;
    }
  }
  return outcome;
}
