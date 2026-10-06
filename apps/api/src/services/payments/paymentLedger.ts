import type { PaymentLedgerKind } from '@keres/shared/metadata/Payments';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, type CompatibleDb } from '../../db';
import { paymentEvents, tiers } from '../../db/schema';

const MAX_DETAIL = 200;

/** A ledger line that starts like this records a payment that was turned down: it is not a payment the person made. */
export const REFUSED_DETAIL_PREFIX = 'Refused:';

/** A short free text for the ledger or the record: bounded, because neither is a place for what anybody sends at will. */
export const clipDetail = (value: string | undefined | null) =>
  value ? value.slice(0, MAX_DETAIL) : null;

export interface LedgerInput {
  kind: PaymentLedgerKind;
  providerId: string;
  providerEventId?: string | null;
  userId?: string | null;
  tierName?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  providerReference?: string | null;
  detail?: string | null;
}

/** The name of a plan, or a plain word for one that is gone: the ledger and the texts must never fail on it. */
export async function tierNameOf(tierId: string): Promise<string> {
  const tier = await db.query.tiers.findFirst({
    where: eq(tiers.id, tierId),
    columns: { name: true },
  });
  return tier?.name ?? 'Plan';
}

/**
 * Writes one line of the ledger. False when the provider's notice id was already there - which is how a notice that
 * arrives twice counts once.
 */
export async function noteLedger(tx: CompatibleDb, ledger: LedgerInput): Promise<boolean> {
  const inserted = await tx
    .insert(paymentEvents)
    .values({
      id: ulid(),
      providerId: ledger.providerId,
      providerEventId: ledger.providerEventId ?? null,
      kind: ledger.kind,
      userId: ledger.userId ?? null,
      tierName: ledger.tierName ?? null,
      amountCents: ledger.amountCents ?? null,
      currency: ledger.currency ?? null,
      providerReference: ledger.providerReference ?? null,
      detail: clipDetail(ledger.detail),
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  return inserted.length > 0;
}
