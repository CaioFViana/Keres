import { and, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '@/db';
import { termsAcceptances, type LegalDocumentKind } from '@/db/schema/tables/termsAcceptances';
import { PRIVACY_POLICY_VERSION, privacyPolicyDigest } from '@/legal/privacyPolicy';
import { SERVER_TERMS_VERSION, serverTermsDigest } from '@/legal/serverTerms';
import { ageVerificationMode } from './ageVerification/ageVerificationMode';

export type LegalAcceptanceMethod = 'registration' | 'reaccept';

/**
 * The digest is taken per call, in the mode the server runs in now: a `disabled` server's acceptances are of the text it
 * shows (see `serverTermsFor`), not of the `required` one.
 */
const CURRENT: Record<LegalDocumentKind, { version: number; digest: () => string }> = {
  tos: { version: SERVER_TERMS_VERSION, digest: () => serverTermsDigest(ageVerificationMode()) },
  privacy: {
    version: PRIVACY_POLICY_VERSION,
    digest: () => privacyPolicyDigest(ageVerificationMode()),
  },
};

export interface LegalDocumentStatus {
  /** Newest version this account accepted, `null` when it never did. */
  accepted: number | null;
  current: number;
}

export interface LegalAcceptanceStatus {
  tos: LegalDocumentStatus;
  privacy: LegalDocumentStatus;
}

export class TermsAcceptanceService {
  /** Newest version accepted, `null` when never. History is kept; only the newest counts. */
  async acceptedVersion(userId: string, kind: LegalDocumentKind): Promise<number | null> {
    const [latest] = await db
      .select({ version: termsAcceptances.version })
      .from(termsAcceptances)
      .where(and(eq(termsAcceptances.userId, userId), eq(termsAcceptances.kind, kind)))
      .orderBy(desc(termsAcceptances.acceptedAt), desc(termsAcceptances.id))
      .limit(1);
    return latest?.version ?? null;
  }

  /**
   * Records that the account accepted the current text. Idempotent: accepting twice without
   * a version bump in between writes once. A bump writes a new row and keeps the old ones.
   */
  async recordAcceptance(
    userId: string,
    kind: LegalDocumentKind,
    method: LegalAcceptanceMethod,
  ): Promise<void> {
    const { version, digest } = CURRENT[kind];
    const textHash = digest();
    const [latest] = await db
      .select({ version: termsAcceptances.version, textHash: termsAcceptances.textHash })
      .from(termsAcceptances)
      .where(and(eq(termsAcceptances.userId, userId), eq(termsAcceptances.kind, kind)))
      .orderBy(desc(termsAcceptances.acceptedAt), desc(termsAcceptances.id))
      .limit(1);
    if (latest && latest.version === version && latest.textHash === textHash) return;
    await db.insert(termsAcceptances).values({
      id: ulid(),
      userId,
      kind,
      version,
      textHash,
      method,
    });
  }

  /** Every acceptance row, newest first - the full history for the data export. */
  async history(userId: string) {
    return db
      .select({
        kind: termsAcceptances.kind,
        version: termsAcceptances.version,
        textHash: termsAcceptances.textHash,
        method: termsAcceptances.method,
        acceptedAt: termsAcceptances.acceptedAt,
      })
      .from(termsAcceptances)
      .where(eq(termsAcceptances.userId, userId))
      .orderBy(desc(termsAcceptances.acceptedAt), desc(termsAcceptances.id));
  }

  /** What the account accepted against what applies now - the client re-presents whatever lags. */
  async status(userId: string): Promise<LegalAcceptanceStatus> {
    const [tos, privacy] = await Promise.all([
      this.acceptedVersion(userId, 'tos'),
      this.acceptedVersion(userId, 'privacy'),
    ]);
    return {
      tos: { accepted: tos, current: SERVER_TERMS_VERSION },
      privacy: { accepted: privacy, current: PRIVACY_POLICY_VERSION },
    };
  }
}

export const termsAcceptanceService = new TermsAcceptanceService();
