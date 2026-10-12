import { randomBytes, randomUUID } from 'node:crypto';
import type {
  VerificationEventWire,
  VerificationRequestWire,
  VerificationResultWire,
} from './wire';
import { newDataKey } from './crypto/seal';
import { newUploadToken, type UploadToken } from './crypto/token';
import { eventIdFor } from './decisions';
import type { Services } from './services';
import { destroySubmission } from './crypto/destroy';
import { OPEN_SUBMISSION_STATUSES, type SubmissionRow } from './store/submissions';
import { transaction } from './store/sql';

/**
 * What the protocol asks of a sending, without the HTTP: create it (idempotent on the verification id), rotate its
 * upload link, read how it ended, and cancel it. The routes call these; the tests call them too.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Started {
  row: SubmissionRow;
  /** The link the person opens. Only here, never stored: the row keeps its hash. */
  upload: UploadToken;
}

export const uploadUrl = (publicUrl: string, token: string): string => `${publicUrl}/v/${token}`;

/** Whether a repeated request names the same thing as the one that created the sending. */
function sameRequest(row: SubmissionRow, request: VerificationRequestWire): boolean {
  return (
    row.subjectUserId === request.subject.userId &&
    row.subjectUsername === request.subject.username &&
    row.language === request.language &&
    row.retryOf === (request.retryOf ?? null)
  );
}

/**
 * Starts a sending for a verification id. The same id answers the same sending (the same reference, the same
 * expiry); its upload link is re-issued, because only the hash of the first one was kept. Throws `Conflict` when the
 * id was used for another person.
 */
export function startVerification(services: Services, request: VerificationRequestWire): Started {
  const { stores, config } = services;
  const existing = stores.submissions.byVerificationId(request.verificationId);
  if (existing) {
    if (!sameRequest(existing, request))
      throw new Conflict('This verification id names another request.');
    const upload = newUploadToken();
    stores.submissions.setUploadTokenHash(existing.id, upload.hash);
    return { row: { ...existing, uploadTokenHash: upload.hash }, upload };
  }
  if (request.retryOf !== undefined && !stores.submissions.byProviderReference(request.retryOf)) {
    throw new UnknownRetry();
  }

  const now = services.clock();
  const id = randomUUID();
  const upload = newUploadToken();
  const row = {
    id,
    verificationId: request.verificationId,
    providerReference: `av-${randomBytes(16).toString('base64url')}`,
    subjectUserId: request.subject.userId,
    subjectUsername: request.subject.username,
    language: request.language,
    retryOf: request.retryOf ?? null,
    uploadTokenHash: upload.hash,
    createdAt: now,
    expiresAt: now + config.submissionTtlDays * DAY_MS,
  };
  // The key exists before the row that names the submission: a row never exists without the key that protects it.
  stores.keys.put(id, newDataKey());
  try {
    stores.submissions.insert(row);
  } catch (error) {
    stores.keys.delete(id);
    throw error;
  }
  return {
    row: {
      ...row,
      status: 'pending',
      uploadedAt: null,
      decidedAt: null,
      reviewerId: null,
      decidedByReviewer: null,
      blobsJson: null,
    },
    upload,
  };
}

/** The protocol's answer for a started sending. */
export function resultOf(services: Services, started: Started): VerificationResultWire {
  return {
    providerReference: started.row.providerReference,
    action: { kind: 'redirect', url: uploadUrl(services.config.publicUrl, started.upload.token) },
    expiresAt: new Date(started.row.expiresAt).toISOString(),
  };
}

/** How a sending ended, as the event it was reported with; null while it is still open or was only cancelled. */
export function endedEventOf(services: Services, row: SubmissionRow): VerificationEventWire | null {
  if (row.status !== 'approved' && row.status !== 'rejected' && row.status !== 'expired')
    return null;
  return services.stores.outbox.payloadOf(eventIdFor(row.id, row.status)) ?? null;
}

/**
 * Ends a sending nobody will decide: its key and files are destroyed; an open one becomes `canceled`. A sending that
 * is already decided or ended keeps its status; a second cancel changes nothing.
 */
export function cancelSending(services: Services, row: SubmissionRow): void {
  const { stores } = services;
  destroySubmission(stores, row.id);
  if (!OPEN_SUBMISSION_STATUSES.includes(row.status)) return;
  const now = services.clock();
  transaction(stores.data, () => {
    stores.submissions.markEnded(row.id, 'canceled', now);
    stores.audit.record({ at: now, reviewerId: null, submissionId: row.id, action: 'cancel' });
  });
}

export class Conflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Conflict';
  }
}

export class UnknownRetry extends Error {
  constructor() {
    super('The retried sending is unknown.');
    this.name = 'UnknownRetry';
  }
}
