import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventIdFor, expireOverdue } from '../src/decisions';
import { deliverDueEvents, OUTBOX_BATCH, retryDelayMs, startOutbox } from '../src/outbox';
import { NonceCache, verifyEventPush, type Verdict } from '../src/protocol/signing';
import { storeBlob } from '../src/store/blobs';
import { startVerification } from '../src/verifications';
import { commitment } from '../src/crypto/commitment';
import { approve, reject } from './helpers/decide';
import { COMMITMENT_KEY, EVENTS_SECRET, harness, type Harness, T0 } from './helpers/harness';

const DAY = 24 * 60 * 60 * 1000;
const EVENTS_PATH = '/api/age-verification/events';
const IMAGE = Buffer.from('photo bytes for the outbox tests');

interface Push {
  path: string;
  method: string;
  body: string;
  verdict: Verdict;
}

/**
 * A fake Keres events endpoint. It checks every push with the real event-direction verifier, under the events key,
 * and answers with the statuses it is scripted to (200 once the script runs out).
 */
function fakeKeres(h: Harness, script: number[] = []) {
  const nonces = new NonceCache();
  const pushes: Push[] = [];
  const queue = [...script];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    const body = String(init?.body ?? '');
    const path = `${url.pathname}${url.search}`;
    const verdict = verifyEventPush({
      method: String(init?.method),
      path,
      headers,
      body,
      secrets: [EVENTS_SECRET],
      nonces,
      now: h.now(),
    });
    pushes.push({ path, method: String(init?.method), body, verdict });
    const status = queue.shift() ?? 200;
    return new Response(status === 200 ? '{"ok":true}' : 'refused', { status });
  }) as typeof fetch;
  return { fetchImpl, pushes };
}

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  vi.restoreAllMocks();
  h.close();
});

/** Two decided sendings: one approved, one rejected. Returns their ids. */
function twoDecisions(): { approved: string; rejected: string } {
  const approving = startVerification(h.state, {
    verificationId: 'v-approve',
    subject: { userId: 'user-1', username: 'ana' },
    language: 'pt-BR',
  });
  const rejecting = startVerification(h.state, {
    verificationId: 'v-reject',
    subject: { userId: 'user-2', username: 'bea' },
    language: 'pt-BR',
  });
  for (const id of [approving.row.id, rejecting.row.id]) {
    storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: IMAGE,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    h.state.stores.submissions.markUploaded(id, h.now());
  }
  approve(h, approving.row.id, 'reviewer-1', {
    name: 'Ana Souza',
    kind: 'cpf',
    number: '123.456.789-09',
    dateOfBirth: '1990-07-23',
  });
  reject(h, rejecting.row.id, 'reviewer-1', 'face_mismatch');
  return { approved: approving.row.id, rejected: rejecting.row.id };
}

describe('delivery to Keres', () => {
  it('pushes the due events in one signed batch, then never again once Keres has answered 2xx', async () => {
    const { approved, rejected } = twoDecisions();
    const keres = fakeKeres(h);

    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(2);
    expect(keres.pushes).toHaveLength(1);
    const [push] = keres.pushes;
    expect(push?.method).toBe('POST');
    expect(push?.path).toBe(EVENTS_PATH);
    expect(push?.verdict).toEqual({ ok: true });

    const sent = JSON.parse(push?.body ?? '{}') as { events: { eventId: string; type: string }[] };
    expect(sent.events.map((event) => event.eventId).sort()).toEqual(
      [eventIdFor(approved, 'approved'), eventIdFor(rejected, 'rejected')].sort(),
    );
    expect(sent.events.find((event) => event.type === 'verification.approved')).toMatchObject({
      method: 'manual-document-live-photo',
      identityCommitment: commitment(COMMITMENT_KEY, {
        name: 'Ana Souza',
        kind: 'cpf',
        number: '123.456.789-09',
      }),
    });

    expect(h.state.stores.outbox.undeliveredCount()).toBe(0);
    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(0);
    expect(keres.pushes).toHaveLength(1);
  });

  it('retries a 500 with back-off, and delivers on the attempt after the wait', async () => {
    const { approved, rejected } = twoDecisions();
    const keres = fakeKeres(h, [500, 200]);
    const failedAt = h.now();

    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(0);
    expect(keres.pushes).toHaveLength(1);
    expect(h.state.stores.outbox.undeliveredCount()).toBe(2);

    // Not due before the wait is over.
    expect(h.state.stores.outbox.due(failedAt + retryDelayMs(1) - 1, 10)).toEqual([]);
    const due = h.state.stores.outbox.due(failedAt + retryDelayMs(1), 10);
    expect(due.map((row) => row.attempts)).toEqual([1, 1]);

    h.setNow(failedAt + retryDelayMs(1));
    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(2);
    expect(keres.pushes).toHaveLength(2);
    expect(keres.pushes[1]?.verdict).toEqual({ ok: true });
    expect(JSON.parse(keres.pushes[1]?.body ?? '{}')).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ eventId: eventIdFor(approved, 'approved') }),
      ]),
    });
    expect(keres.pushes[1]?.body).toContain(eventIdFor(rejected, 'rejected'));
  });

  it('survives Keres being unreachable, and logs the status only, never a payload', async () => {
    const { approved } = twoDecisions();
    const warnings: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
    const unreachable = (async () => {
      throw new TypeError('connection refused');
    }) as unknown as typeof fetch;

    expect(await deliverDueEvents(h.state, unreachable)).toBe(0);
    expect(h.state.stores.outbox.due(h.now() + retryDelayMs(1), 10)).toHaveLength(2);

    h.setNow(h.now() + retryDelayMs(1));
    const refused = fakeKeres(h, [500]);
    expect(await deliverDueEvents(h.state, refused.fetchImpl)).toBe(0);
    expect(refused.pushes).toHaveLength(1);

    const logged = warnings.join('\n');
    expect(logged).toMatch(/no answer/);
    expect(logged).toMatch(/status 500/);
    expect(logged).not.toContain(eventIdFor(approved, 'approved'));
    expect(logged).not.toContain(
      commitment(COMMITMENT_KEY, { name: 'Ana Souza', kind: 'cpf', number: '123.456.789-09' }),
    );
  });

  it('never pushes more than one batch of 100 events, and sends the rest in the next push', async () => {
    const now = h.now();
    for (let index = 0; index < OUTBOX_BATCH + 5; index += 1) {
      h.state.stores.outbox.enqueue(
        {
          type: 'verification.expired',
          eventId: `synthetic-${index}`,
          verificationId: `v-${index}`,
          discardedAt: new Date(now).toISOString(),
        },
        now,
      );
    }
    const keres = fakeKeres(h);
    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(OUTBOX_BATCH);
    expect(
      (JSON.parse(keres.pushes[0]?.body ?? '{}') as { events: unknown[] }).events,
    ).toHaveLength(OUTBOX_BATCH);
    expect(await deliverDueEvents(h.state, keres.fetchImpl)).toBe(5);
    expect(
      (JSON.parse(keres.pushes[1]?.body ?? '{}') as { events: unknown[] }).events,
    ).toHaveLength(5);
  });

  it('waits longer after each failure, and never more than an hour', () => {
    expect(retryDelayMs(1)).toBe(10_000);
    expect(retryDelayMs(2)).toBe(20_000);
    expect(retryDelayMs(3)).toBe(40_000);
    expect(retryDelayMs(50)).toBe(60 * 60 * 1000);
  });

  it('a round of the timer ends what has expired, delivers it, and stops cleanly', async () => {
    const started = startVerification(h.state, {
      verificationId: 'v-timer',
      subject: { userId: 'user-3', username: 'cris' },
      language: 'pt-BR',
    });
    h.setNow(T0 + 30 * DAY + 1);
    const keres = fakeKeres(h);

    const loop = startOutbox(h.state, { intervalMs: 60_000, fetchImpl: keres.fetchImpl });
    await loop.tick();
    await loop.stop();

    expect(h.state.stores.submissions.byId(started.row.id)?.status).toBe('expired');
    expect(h.state.stores.outbox.undeliveredCount()).toBe(0);
    expect(keres.pushes).toHaveLength(1);
    expect(keres.pushes[0]?.verdict).toEqual({ ok: true });
    expect(expireOverdue(h.state)).toBe(0);
  });
});
