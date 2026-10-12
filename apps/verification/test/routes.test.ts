import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storeBlob } from '../src/store/blobs';
import { all } from '../src/store/sql';
import type { PageRoute } from '../src/routes';
import { approve, reject } from './helpers/decide';
import {
  answerIsSigned,
  bytesContain,
  harness,
  type Harness,
  PREVIOUS_KERES_SECRET,
  PUBLIC_URL,
  signedCall,
  T0,
} from './helpers/harness';

const DAY = 24 * 60 * 60 * 1000;
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const REQUEST = {
  verificationId: 'verification-1',
  subject: { userId: 'user-1', username: 'ana' },
  language: 'pt-BR',
};

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  h.close();
});

const tokenOf = (url: string): string => url.slice(`${PUBLIC_URL}/v/`.length);

async function start(body: unknown = REQUEST) {
  return signedCall(h, 'POST', '/v1/verifications', { body });
}

function rowOf(verificationId: string) {
  return h.state.stores.submissions.byVerificationId(verificationId);
}

describe('GET /v1/info', () => {
  it('answers the service identity and its optional capabilities, signed', async () => {
    const answer = await signedCall(h, 'GET', '/v1/info');
    expect(answer.status).toBe(200);
    expect(answer.json).toEqual({
      apiVersion: 1,
      id: 'keres-manual',
      displayName: 'Keres manual verification',
      capabilities: ['status', 'cancel'],
    });
    expect(answerIsSigned(answer)).toBe(true);
  });
});

describe('POST /v1/verifications', () => {
  it('starts a pending sending and answers the reference and the upload link, with an https expiry', async () => {
    const answer = await start();
    expect(answer.status).toBe(200);
    const body = answer.json as {
      providerReference: string;
      action: { kind: string; url: string };
      expiresAt: string;
    };
    expect(body.providerReference).toMatch(/^av-/);
    expect(body.action.kind).toBe('redirect');
    expect(body.action.url.startsWith(`${PUBLIC_URL}/v/`)).toBe(true);
    expect(body.expiresAt).toBe(new Date(T0 + 30 * DAY).toISOString());
    expect(answerIsSigned(answer)).toBe(true);

    const row = rowOf('verification-1');
    expect(row?.status).toBe('pending');
    expect(row?.providerReference).toBe(body.providerReference);
    expect(row?.subjectUserId).toBe('user-1');
    expect(h.state.stores.keys.get(row?.id ?? '')).toBeDefined();
  });

  it('stores the hash of the upload token, never the token itself', async () => {
    const body = (await start()).json as { action: { url: string } };
    const token = tokenOf(body.action.url);
    const row = rowOf('verification-1');
    expect(row?.uploadTokenHash).toBe(sha256(token));
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(bytesContain(h.root, token)).toBe(false);
  });

  it('is idempotent on the verification id: the same reference and expiry, one row, a fresh link', async () => {
    const first = (await start()).json as {
      providerReference: string;
      expiresAt: string;
      action: { url: string };
    };
    const again = await start();
    const second = again.json as {
      providerReference: string;
      expiresAt: string;
      action: { url: string };
    };
    expect(again.status).toBe(200);
    expect(second.providerReference).toBe(first.providerReference);
    expect(second.expiresAt).toBe(first.expiresAt);
    expect(
      all<{ n: number }>(h.state.stores.data, 'SELECT COUNT(*) AS n FROM submissions')[0]?.n,
    ).toBe(1);
    // Only the hash of the first link was kept, so the link is re-issued: the newest one is the one that works.
    expect(second.action.url).not.toBe(first.action.url);
    expect(rowOf('verification-1')?.uploadTokenHash).toBe(sha256(tokenOf(second.action.url)));
    expect(rowOf('verification-1')?.uploadTokenHash).not.toBe(sha256(tokenOf(first.action.url)));
  });

  it('refuses a verification id reused for another person, with 409', async () => {
    await start();
    const other = await start({ ...REQUEST, subject: { userId: 'user-2', username: 'bea' } });
    expect(other.status).toBe(409);
    expect(rowOf('verification-1')?.subjectUserId).toBe('user-1');
  });

  it('refuses a body that does not match the protocol, with 400, and says nothing else', async () => {
    const missing = await signedCall(h, 'POST', '/v1/verifications', {
      body: { verificationId: 'x' },
    });
    expect(missing.status).toBe(400);
    expect(missing.json).toEqual({ message: 'Invalid verification request.' });
    const notJson = await signedCall(h, 'POST', '/v1/verifications', { rawBody: '{not json' });
    expect(notJson.status).toBe(400);
    const badLanguage = await start({ ...REQUEST, language: 'x' });
    expect(badLanguage.status).toBe(400);
    expect(rowOf('verification-1')).toBeUndefined();
  });

  it('starts a retry of a known sending, and refuses one whose retryOf is unknown', async () => {
    const first = (await start()).json as { providerReference: string };
    const retry = await start({
      ...REQUEST,
      verificationId: 'verification-2',
      retryOf: first.providerReference,
    });
    expect(retry.status).toBe(200);
    expect(rowOf('verification-2')?.retryOf).toBe(first.providerReference);

    const unknown = await start({
      ...REQUEST,
      verificationId: 'verification-3',
      retryOf: 'av-nobody',
    });
    expect(unknown.status).toBe(400);
    expect(unknown.json).toEqual({ message: 'The retried sending is unknown.' });
  });
});

describe('GET /v1/verifications/:id', () => {
  it('answers null while the sending is open', async () => {
    const started = (await start()).json as { providerReference: string };
    const answer = await signedCall(
      h,
      'GET',
      `/v1/verifications/verification-1?providerReference=${started.providerReference}`,
    );
    expect(answer.status).toBe(200);
    expect(answer.json).toEqual({ event: null });
    expect(answerIsSigned(answer)).toBe(true);
  });

  it('answers the decided event once the reviewer has decided, the same event as was queued', async () => {
    const started = (await start()).json as { providerReference: string };
    const row = rowOf('verification-1');
    storeBlob(h.state.stores, row?.id ?? '', {
      role: 'photo',
      plain: Buffer.from('p'),
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    h.state.stores.submissions.markUploaded(row?.id ?? '', h.now());
    approve(h, row?.id ?? '', 'reviewer-1', {
      name: 'Ana Souza',
      kind: 'cpf',
      number: '123.456.789-09',
      dateOfBirth: '1990-07-23',
    });

    const answer = await signedCall(
      h,
      'GET',
      `/v1/verifications/verification-1?providerReference=${started.providerReference}`,
    );
    const body = answer.json as {
      event: { type: string; eventId: string; identityCommitment: string };
    };
    expect(body.event.type).toBe('verification.approved');
    expect(body.event.identityCommitment).toMatch(/^[0-9a-f]{64}$/);
    expect(body.event.eventId).toBe(h.state.stores.outbox.payloadOf(body.event.eventId)?.eventId);
  });

  it('answers a rejection with its reason', async () => {
    const started = (await start()).json as { providerReference: string };
    const id = rowOf('verification-1')?.id ?? '';
    h.state.stores.submissions.markUploaded(id, h.now());
    reject(h, id, 'reviewer-1', 'document_not_original');
    const answer = await signedCall(
      h,
      'GET',
      `/v1/verifications/verification-1?providerReference=${started.providerReference}`,
    );
    expect(answer.json).toMatchObject({
      event: { type: 'verification.rejected', reason: 'document_not_original' },
    });
  });

  it('refuses a reference that is not the one of this verification, and a missing one', async () => {
    await start();
    const wrong = await signedCall(
      h,
      'GET',
      '/v1/verifications/verification-1?providerReference=av-wrong',
    );
    expect(wrong.status).toBe(404);
    const missing = await signedCall(h, 'GET', '/v1/verifications/verification-1');
    expect(missing.status).toBe(400);
  });
});

describe('POST /v1/verifications/:ref/cancel', () => {
  it('destroys an open sending and ends it as canceled, and a second cancel changes nothing', async () => {
    const started = (await start()).json as { providerReference: string };
    const id = rowOf('verification-1')?.id ?? '';
    const first = await signedCall(
      h,
      'POST',
      `/v1/verifications/${started.providerReference}/cancel`,
    );
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ ok: true });

    expect(rowOf('verification-1')?.status).toBe('canceled');
    expect(h.state.stores.keys.get(id)).toBeUndefined();
    const auditAfterFirst = h.state.stores.audit.forSubmission(id).map((entry) => entry.action);
    expect(auditAfterFirst).toEqual(['cancel']);

    const second = await signedCall(
      h,
      'POST',
      `/v1/verifications/${started.providerReference}/cancel`,
    );
    expect(second.json).toEqual({ ok: true });
    expect(h.state.stores.audit.forSubmission(id).map((entry) => entry.action)).toEqual(['cancel']);
    expect(answerIsSigned(second)).toBe(true);
  });

  it('answers ok for a reference nobody here knows', async () => {
    const answer = await signedCall(h, 'POST', '/v1/verifications/av-unknown/cancel');
    expect(answer.status).toBe(200);
    expect(answer.json).toEqual({ ok: true });
  });

  it('leaves a decided sending decided', async () => {
    const started = (await start()).json as { providerReference: string };
    const id = rowOf('verification-1')?.id ?? '';
    h.state.stores.submissions.markUploaded(id, h.now());
    reject(h, id, 'reviewer-1', 'other');
    await signedCall(h, 'POST', `/v1/verifications/${started.providerReference}/cancel`);
    expect(rowOf('verification-1')?.status).toBe('rejected');
  });
});

describe('the signed edge', () => {
  it('refuses a request signed with a wrong key, with 401 and no reason', async () => {
    const answer = await signedCall(h, 'GET', '/v1/info', {
      secret: 'test-not-the-keres-secret-0123456789',
    });
    expect(answer.status).toBe(401);
    expect(answer.json).toEqual({ message: 'Refused.' });
  });

  it('refuses a payments signature on the age protocol, even with the right key', async () => {
    const answer = await signedCall(h, 'GET', '/v1/info', { scheme: 'payments' });
    expect(answer.status).toBe(401);
  });

  it('refuses a replayed nonce, and a stale timestamp', async () => {
    const first = await signedCall(h, 'GET', '/v1/info', { nonce: 'replay-nonce-0123456789' });
    expect(first.status).toBe(200);
    const replay = await signedCall(h, 'GET', '/v1/info', { nonce: 'replay-nonce-0123456789' });
    expect(replay.status).toBe(401);
    const stale = await signedCall(h, 'GET', '/v1/info', {
      timestamp: Math.floor(h.now() / 1000) - 3600,
    });
    expect(stale.status).toBe(401);
  });

  it('accepts the previous key only while it is configured', async () => {
    const previous = harness({ env: { AGE_VERIFICATION_SECRET_PREVIOUS: PREVIOUS_KERES_SECRET } });
    try {
      const accepted = await signedCall(previous, 'GET', '/v1/info', {
        secret: PREVIOUS_KERES_SECRET,
      });
      expect(accepted.status).toBe(200);
      expect(answerIsSigned(accepted)).toBe(true);
    } finally {
      previous.close();
    }
    const refused = await signedCall(h, 'GET', '/v1/info', { secret: PREVIOUS_KERES_SECRET });
    expect(refused.status).toBe(401);
  });

  it('answers 404 for an unknown protocol path, signed', async () => {
    const answer = await signedCall(h, 'GET', '/v1/nothing-here');
    expect(answer.status).toBe(404);
    expect(answerIsSigned(answer)).toBe(true);
  });

  it('serves /health without a signature', async () => {
    const response = await h.app.fetch(new Request('http://127.0.0.1:3102/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('extension point for the pages of the next task', () => {
  it('tries the page routes for anything outside /v1, in order, before the 404', async () => {
    const page: PageRoute = (_request, url) =>
      url.pathname.startsWith('/v/') ? new Response('upload page', { status: 200 }) : undefined;
    const served = harness({ pages: [page] });
    try {
      const upload = await served.app.fetch(new Request('http://127.0.0.1:3102/v/some-token'));
      expect(await upload.text()).toBe('upload page');
      const other = await served.app.fetch(new Request('http://127.0.0.1:3102/elsewhere'));
      expect(other.status).toBe(404);
    } finally {
      served.close();
    }
  });
});
