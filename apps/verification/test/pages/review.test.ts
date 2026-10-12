import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commitment } from '../../src/crypto/commitment';
import { eventIdFor, type ReviewedIdentity } from '../../src/decisions';
import { LOCK_MS } from '../../src/pages/review/login';
import {
  bytesContain,
  COMMITMENT_KEY,
  harness,
  type Harness,
  ORIGIN,
  T0,
} from '../helpers/harness';
import {
  asReviewer,
  csrfIn,
  getPage,
  goodParts,
  nonceOf,
  postPage,
  reviewer,
  type Sending,
  signIn,
  startSending,
  type Signed,
  uploadTo,
  withoutNonce,
} from './helpers';

const MINUTE = 60 * 1000;
const UUID = '00000000-0000-4000-8000-000000000000';
const ADULT: ReviewedIdentity = {
  name: 'ZELIA QUARENTA',
  kind: 'rg',
  number: '987.654.321-09',
  dateOfBirth: '1990-07-23',
};
const UNDERAGE: ReviewedIdentity = { ...ADULT, dateOfBirth: '2010-10-13' };

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  h.close();
});

const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

/**
 * A reviewer's action: a form post with the session and the CSRF token it was given. `csrf` defaults to the session's
 * token, a string replaces it, and `null` posts no token at all.
 */
function act(
  path: string,
  s: Signed | undefined,
  fields: Record<string, string> = {},
  csrf?: string | null,
): Promise<Response> {
  const token = csrf === null ? undefined : (csrf ?? s?.csrf);
  const body = new URLSearchParams(token === undefined ? fields : { csrf: token, ...fields });
  return postPage(h, path, body, {
    ...FORM,
    ...(s ? { cookie: s.cookie } : {}),
    'x-forwarded-for': '198.51.100.10',
  });
}

/** A sending uploaded through its link, as the person would leave it. */
async function uploaded(options: Parameters<typeof startSending>[1] = {}): Promise<Sending> {
  const sending = await startSending(h, options);
  const response = await uploadTo(h, sending.token, goodParts(sending.id.slice(0, 4)));
  expect(response.status).toBe(200);
  return sending;
}

const statusOf = (sending: Sending) => h.state.stores.submissions.byId(sending.id)?.status;
const eventOf = (sending: Sending, outcome: 'approved' | 'rejected' | 'expired') =>
  h.state.stores.outbox.payloadOf(eventIdFor(sending.id, outcome));
const imagesDir = () => join(h.state.stores.blobDir);
const flashOf = (response: Response): string =>
  new URL(response.headers.get('location') ?? '', ORIGIN).search;

describe('reviewer sign-in', () => {
  it('shows the sign-in form under the same headers as every page, in the browser language', async () => {
    await reviewer(h, 'rita');
    const response = await getPage(h, '/review/login', { 'accept-language': 'pt-BR' });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('Entrada do revisor');
    expect(html).toContain('name="password"');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-inline');
    expect(html).toContain(`<style nonce="${nonceOf(response)}">`);
  });

  it('gives the same answer for an unknown name and for a wrong password', async () => {
    await reviewer(h, 'rita');
    const unknown = await postPage(
      h,
      '/review/login',
      new URLSearchParams({ name: 'nobody', password: 'wrong wrong wrong wrong' }),
      { ...FORM, 'x-forwarded-for': '198.51.100.1' },
    );
    const wrong = await postPage(
      h,
      '/review/login',
      new URLSearchParams({ name: 'rita', password: 'wrong wrong wrong wrong' }),
      { ...FORM, 'x-forwarded-for': '198.51.100.2' },
    );
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    const unknownHtml = await unknown.text();
    const wrongHtml = await wrong.text();
    expect(unknownHtml).toContain('The name or the password is wrong.');
    expect(withoutNonce(wrongHtml)).toBe(withoutNonce(unknownHtml));
    expect(unknown.headers.get('set-cookie')).toBeNull();
  });

  it('locks a name and address pair for 15 minutes after five failures; another address is not locked', async () => {
    await reviewer(h, 'rita');
    const attempt = (password: string, ip: string) =>
      postPage(h, '/review/login', new URLSearchParams({ name: 'rita', password }), {
        ...FORM,
        'x-forwarded-for': ip,
      });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1)
      statuses.push((await attempt('wrong wrong wrong wrong', '203.0.113.5')).status);
    expect(statuses).toEqual([401, 401, 401, 401, 429]);

    const locked = await attempt('correct horse battery staple', '203.0.113.5');
    expect(locked.status).toBe(429);
    expect(await locked.text()).toContain('Too many failed attempts');

    expect((await attempt('correct horse battery staple', '203.0.113.6')).status).toBe(303);

    h.setNow(T0 + LOCK_MS + MINUTE);
    expect((await attempt('correct horse battery staple', '203.0.113.5')).status).toBe(303);
  });

  it('opens a session with an HttpOnly, SameSite=Strict, Secure cookie for /review, and keeps only the token hash', async () => {
    await reviewer(h, 'rita');
    const session = await signIn(h, 'rita');
    const response = await postPage(
      h,
      '/review/login',
      new URLSearchParams({ name: 'rita', password: 'correct horse battery staple' }),
      { ...FORM, 'x-forwarded-for': '198.51.100.44' },
    );
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/review');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/review');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain(`Max-Age=${8 * 60 * 60}`);
    expect(bytesContain(h.root, session.token)).toBe(false);
  });

  it('leaves Secure off the cookie only when the public address is plain http (loopback or a private network)', async () => {
    const local = harness({
      env: { PUBLIC_URL: 'http://127.0.0.1:3102', ALLOW_INSECURE: 'false' },
    });
    try {
      await reviewer(local, 'rita');
      const response = await postPage(
        local,
        '/review/login',
        new URLSearchParams({ name: 'rita', password: 'correct horse battery staple' }),
        { ...FORM, 'x-forwarded-for': '198.51.100.9' },
      );
      expect(response.headers.get('set-cookie')).not.toContain('Secure');
    } finally {
      local.close();
    }
  });

  it('refuses a sign-in posted from another site', async () => {
    await reviewer(h, 'rita');
    const response = await postPage(
      h,
      '/review/login',
      new URLSearchParams({ name: 'rita', password: 'correct horse battery staple' }),
      { ...FORM, origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('keeps its pages able to post their own forms: a browser sends `Origin: null` under `no-referrer`', async () => {
    // Found in a real browser: with `Referrer-Policy: no-referrer` every form post of the pages was refused by the
    // origin check. The pages must not use that policy, and a null origin stays refused (it also comes from sandboxes).
    const page = await getPage(h, '/review/login');
    expect(page.headers.get('referrer-policy')).not.toBe('no-referrer');
    await reviewer(h, 'nina');
    const nullOrigin = await postPage(
      h,
      '/review/login',
      new URLSearchParams({ name: 'nina', password: 'correct horse battery staple' }),
      { ...FORM, origin: 'null' },
    );
    expect(nullOrigin.status).toBe(403);
  });

  it('sends everything but sign-in to the sign-in page without a session, and gives no image without one', async () => {
    const sending = await uploaded();
    const paths = ['/review', `/review/items/${sending.id}`];
    for (const path of paths) {
      const response = await getPage(h, path);
      expect(response.status, path).toBe(303);
      expect(response.headers.get('location'), path).toBe('/review/login');
    }
    const claim = await act(`/review/items/${sending.id}/claim`, undefined, {}, '');
    expect(claim.status).toBe(303);
    expect(statusOf(sending)).toBe('uploaded');
    const image = await getPage(h, `/review/items/${sending.id}/doc/1`);
    expect(image.status).toBe(403);
    expect(await image.text()).toBe('');
  });

  it('ends the session on sign-out: the row goes, the cookie is cleared, and the old cookie opens nothing', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const before = await getPage(h, '/review', asReviewer(s));
    expect(before.status).toBe(200);

    const refused = await act('/review/logout', s, {}, 'wrong');
    expect(refused.status).toBe(403);
    expect((await getPage(h, '/review', asReviewer(s))).status).toBe(200);

    const out = await act('/review/logout', s);
    expect(out.status).toBe(303);
    expect(out.headers.get('location')).toBe('/review/login?flash=signed-out');
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await getPage(h, '/review', asReviewer(s))).status).toBe(303);
  });
});

describe('the queue', () => {
  it('lists uploaded sendings oldest first, with the age, the attempt and the username only', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const first = await uploaded({ username: 'ana', userId: 'user-ana-7731' });
    h.setNow(T0 + 60 * MINUTE);
    const second = await uploaded({ username: 'bea', userId: 'user-bea-9913' });
    await startSending(h, { username: 'pending-person', userId: 'user-pending-1' });

    const response = await getPage(h, '/review', asReviewer(s));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html.indexOf('<span>ana</span>')).toBeGreaterThan(0);
    expect(html.indexOf('<span>ana</span>')).toBeLessThan(html.indexOf('<span>bea</span>'));
    expect(html).toContain('Attempt 1');
    expect(html).toContain(`action="/review/items/${first.id}/claim"`);
    expect(html).toContain(`action="/review/items/${second.id}/claim"`);
    // Nothing else of the sending: no user id, no reference, no verification id, no pending sending.
    for (const secret of [
      'user-ana-7731',
      first.providerReference,
      first.verificationId,
      'user-pending-1',
      'pending-person',
    ]) {
      expect(html).not.toContain(secret);
    }
    expect(html).toContain('name="csrf" value="');
  });

  it('shows a retry as the second attempt, marked as a retry', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const first = await uploaded({ username: 'caio', userId: 'user-caio' });
    const claim = await act(`/review/items/${first.id}/claim`, s);
    expect(claim.status).toBe(303);
    expect(
      (await act(`/review/items/${first.id}/reject`, s, { reason: 'face_mismatch' })).status,
    ).toBe(303);

    const retry = await uploaded({
      username: 'caio',
      userId: 'user-caio',
      retryOf: first.providerReference,
    });
    const html = await (await getPage(h, '/review', asReviewer(s))).text();
    expect(html).toContain('Attempt 2 (retry)');
    expect(html).toContain(`action="/review/items/${retry.id}/claim"`);
  });
});

describe('claiming and the item screen', () => {
  it('a claim takes the sending for its reviewer, and the claimer sees the checklist and three images', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded({ username: 'ana' });
    const claim = await act(`/review/items/${sending.id}/claim`, s);
    expect(claim.status).toBe(303);
    expect(claim.headers.get('location')).toBe(`/review/items/${sending.id}`);
    expect(statusOf(sending)).toBe('claimed');
    expect(h.state.stores.audit.forSubmission(sending.id).map((entry) => entry.action)).toEqual([
      'claim',
    ]);

    const response = await getPage(h, `/review/items/${sending.id}`, asReviewer(s));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('The check, in this order');
    expect(html).toContain(`src="/review/items/${sending.id}/doc/1"`);
    expect(html).toContain(`src="/review/items/${sending.id}/doc/2"`);
    expect(html).toContain(`src="/review/items/${sending.id}/photo"`);
    expect(response.headers.get('content-security-policy')).toContain("img-src 'self'");
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-inline');
    expect(html).toContain(`<style nonce="${nonceOf(response)}">`);
    expect(html).not.toContain('unsafe-inline');
    // The approval form starts empty, always.
    expect(html).toContain('name="name" type="text" required');
    expect(html).not.toMatch(/name="name"[^>]*value="/);
  });

  it('shows the back only for a sending that has one: a front-only sending has no /doc/2 image on its page', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const { front, photo } = goodParts('onlyfront');
    const frontOnly = await startSending(h, { username: 'bia' });
    expect((await uploadTo(h, frontOnly.token, { front, photo })).status).toBe(200);
    const withBack = await uploaded({ username: 'caio' });
    for (const sending of [frontOnly, withBack]) {
      expect((await act(`/review/items/${sending.id}/claim`, s)).status).toBe(303);
    }

    const bare = await getPage(h, `/review/items/${frontOnly.id}`, asReviewer(s));
    const bareHtml = await bare.text();
    expect(bare.status).toBe(200);
    expect(bareHtml).toContain(`src="/review/items/${frontOnly.id}/doc/1"`);
    expect(bareHtml).toContain(`src="/review/items/${frontOnly.id}/photo"`);
    expect(bareHtml).not.toContain(`/review/items/${frontOnly.id}/doc/2`);
    expect(bareHtml.match(/<img /g)).toHaveLength(2);
    // The image address itself answers nothing either: there is no back to send.
    expect((await getPage(h, `/review/items/${frontOnly.id}/doc/2`, asReviewer(s))).status).toBe(
      404,
    );

    const full = await getPage(h, `/review/items/${withBack.id}`, asReviewer(s));
    const fullHtml = await full.text();
    expect(fullHtml).toContain(`src="/review/items/${withBack.id}/doc/2"`);
    expect(fullHtml.match(/<img /g)).toHaveLength(3);
  });

  it('refuses a second reviewer the sending, with a clear message on the queue', async () => {
    await reviewer(h, 'rita');
    await reviewer(h, 'ivo');
    const rita = await signIn(h, 'rita');
    const ivo = await signIn(h, 'ivo', undefined, '198.51.100.20');
    const sending = await uploaded();
    expect((await act(`/review/items/${sending.id}/claim`, rita)).status).toBe(303);

    const claim = await act(`/review/items/${sending.id}/claim`, ivo);
    expect(claim.status).toBe(303);
    expect(flashOf(claim)).toBe('?flash=held-by-other');
    const page = await getPage(h, `/review/items/${sending.id}`, asReviewer(ivo));
    expect(page.status).toBe(303);
    expect(flashOf(page)).toBe('?flash=held-by-other');
  });

  it('shows the item only to the claimer; an unclaimed sending goes back to the queue with a reason', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    const page = await getPage(h, `/review/items/${sending.id}`, asReviewer(s));
    expect(page.status).toBe(303);
    expect(flashOf(page)).toBe('?flash=not-claimed');
    const html = await (await getPage(h, '/review', asReviewer(s))).text();
    expect(html).toContain('Attempt 1');
  });

  it('a retry is never taken by the reviewer who refused the sending before it; another reviewer takes it', async () => {
    await reviewer(h, 'rita');
    await reviewer(h, 'ivo');
    const rita = await signIn(h, 'rita');
    const ivo = await signIn(h, 'ivo', undefined, '198.51.100.20');
    const first = await uploaded({ username: 'dani', userId: 'user-dani' });
    expect((await act(`/review/items/${first.id}/claim`, rita)).status).toBe(303);
    expect(
      (await act(`/review/items/${first.id}/reject`, rita, { reason: 'document_unreadable' }))
        .status,
    ).toBe(303);

    const retry = await uploaded({
      username: 'dani',
      userId: 'user-dani',
      retryOf: first.providerReference,
    });
    const refused = await act(`/review/items/${retry.id}/claim`, rita);
    expect(refused.status).toBe(303);
    expect(flashOf(refused)).toBe('?flash=retry-refused');
    expect(statusOf(retry)).toBe('uploaded');

    const taken = await act(`/review/items/${retry.id}/claim`, ivo);
    expect(taken.headers.get('location')).toBe(`/review/items/${retry.id}`);
    expect(statusOf(retry)).toBe('claimed');
    const message = await (
      await getPage(h, `/review?flash=retry-refused`, asReviewer(rita))
    ).text();
    expect(message).toContain('goes to another reviewer');
  });
});

describe('the images of a claimed sending', () => {
  it('decrypts each image on request, with the headers the reviewer screen requires, and one audit line per view', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);
    const audited = h.state.stores.audit.forSubmission(sending.id).length;

    const cases = [
      {
        path: `doc/1`,
        type: 'image/jpeg',
        text: 'FRONT-PLAIN-' + sending.id.slice(0, 4) + '-7741',
        action: 'view-document',
      },
      {
        path: `doc/2`,
        type: 'image/png',
        text: 'BACK-PLAIN-' + sending.id.slice(0, 4) + '-7742',
        action: 'view-document',
      },
      {
        path: 'photo',
        type: 'image/webp',
        text: 'PHOTO-PLAIN-' + sending.id.slice(0, 4) + '-7743',
        action: 'view-photo',
      },
    ];
    for (const [index, item] of cases.entries()) {
      const response = await getPage(h, `/review/items/${sending.id}/${item.path}`, asReviewer(s));
      expect(response.status, item.path).toBe(200);
      expect(response.headers.get('content-type')).toBe(item.type);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('content-disposition')).toBe('inline');
      expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.includes(Buffer.from(item.text)), item.path).toBe(true);
      const entries = h.state.stores.audit.forSubmission(sending.id);
      expect(entries.length, item.path).toBe(audited + index + 1);
      expect(entries[entries.length - 1]).toMatchObject({
        reviewerId: expect.any(String),
        action: item.action,
      });
    }
  });

  it('gives nothing to anyone but the claimer, and writes no line for it', async () => {
    await reviewer(h, 'rita');
    await reviewer(h, 'ivo');
    const rita = await signIn(h, 'rita');
    const ivo = await signIn(h, 'ivo', undefined, '198.51.100.20');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, rita);
    const before = h.state.stores.audit.forSubmission(sending.id).length;
    const other = await getPage(h, `/review/items/${sending.id}/photo`, asReviewer(ivo));
    expect(other.status).toBe(404);
    expect(h.state.stores.audit.forSubmission(sending.id).length).toBe(before);
  });

  it('does not show a sending that was decided, or one nobody claimed, at its image addresses', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    expect((await getPage(h, `/review/items/${sending.id}/photo`, asReviewer(s))).status).toBe(404);
    expect((await getPage(h, `/review/items/${UUID}/photo`, asReviewer(s))).status).toBe(404);
  });
});

describe('decisions through the pages', () => {
  it('refuses an approval for a holder under 18: the message, an empty form, and nothing of what was typed is kept', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);

    const response = await act(`/review/items/${sending.id}/approve`, s, {
      name: UNDERAGE.name,
      kind: UNDERAGE.kind,
      number: UNDERAGE.number,
      dateOfBirth: UNDERAGE.dateOfBirth,
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('The holder is under 18 on the day of the decision.');
    expect(html).not.toContain('ZELIA');
    expect(html).not.toContain('987.654');
    expect(html).not.toContain('2010-10-13');
    expect(statusOf(sending)).toBe('claimed');
    expect(eventOf(sending, 'approved')).toBeUndefined();
    expect(bytesContain(h.root, 'ZELIA QUARENTA')).toBe(false);
    expect(bytesContain(h.root, '987.654.321-09')).toBe(false);
    expect(bytesContain(h.root, '98765432109')).toBe(false);
    expect(bytesContain(h.root, '2010-10-13')).toBe(false);
    expect(
      h.state.stores.audit.forSubmission(sending.id).map((entry) => entry.action),
    ).not.toContain('approve');
  });

  it('approves an adult: the event carries a commitment, the images and the key are gone, nothing typed is on disk', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);

    const response = await act(`/review/items/${sending.id}/approve`, s, {
      name: ADULT.name,
      kind: ADULT.kind,
      number: ADULT.number,
      dateOfBirth: ADULT.dateOfBirth,
    });
    expect(response.status).toBe(303);
    expect(flashOf(response)).toBe('?flash=approved');

    const event = eventOf(sending, 'approved');
    expect(event).toMatchObject({
      type: 'verification.approved',
      providerReference: sending.providerReference,
    });
    expect(event && 'identityCommitment' in event ? event.identityCommitment : '').toBe(
      commitment(COMMITMENT_KEY, ADULT),
    );
    expect(statusOf(sending)).toBe('approved');
    expect(h.state.stores.keys.get(sending.id)).toBeUndefined();
    expect(readdirSync(imagesDir())).toEqual([]);
    expect(bytesContain(h.root, 'ZELIA QUARENTA')).toBe(false);
    expect(bytesContain(h.root, '987.654.321-09')).toBe(false);
  });

  it('refuses an approval with a date that is not a date, and stores nothing', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);
    const response = await act(`/review/items/${sending.id}/approve`, s, {
      name: ADULT.name,
      kind: ADULT.kind,
      number: ADULT.number,
      dateOfBirth: '1990-02-30',
    });
    expect(await response.text()).toContain('The date of birth must be a real date');
    expect(statusOf(sending)).toBe('claimed');
    expect(eventOf(sending, 'approved')).toBeUndefined();
  });

  it('refuses an approval of a sending nobody claimed, through the screen', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    const response = await act(`/review/items/${sending.id}/approve`, s, {
      name: ADULT.name,
      kind: ADULT.kind,
      number: ADULT.number,
      dateOfBirth: ADULT.dateOfBirth,
    });
    expect(flashOf(response)).toBe('?flash=not-claimed');
    expect(statusOf(sending)).toBe('uploaded');
    expect(eventOf(sending, 'approved')).toBeUndefined();
  });

  it('refuses a document, with a reason, and destroys the images and the key', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);
    const response = await act(`/review/items/${sending.id}/reject`, s, {
      reason: 'face_mismatch',
    });
    expect(response.status).toBe(303);
    expect(flashOf(response)).toBe('?flash=rejected');
    expect(statusOf(sending)).toBe('rejected');
    expect(eventOf(sending, 'rejected')).toMatchObject({
      type: 'verification.rejected',
      reason: 'face_mismatch',
    });
    expect(h.state.stores.keys.get(sending.id)).toBeUndefined();
    expect(readdirSync(imagesDir())).toEqual([]);
  });

  it('will not refuse with the reason the service sets itself', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    await act(`/review/items/${sending.id}/claim`, s);
    const response = await act(`/review/items/${sending.id}/reject`, s, {
      reason: 'document_reused',
    });
    expect(await response.text()).toContain('That reason cannot be chosen here.');
    expect(statusOf(sending)).toBe('claimed');
    expect(eventOf(sending, 'rejected')).toBeUndefined();
  });
});

describe('CSRF', () => {
  it('refuses a claim, an approval and a refusal with no token or a wrong one, and changes nothing', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const sending = await uploaded();
    const claimNoToken = await act(`/review/items/${sending.id}/claim`, s, {}, null);
    const claimWrong = await act(`/review/items/${sending.id}/claim`, s, {}, 'not-the-token');
    expect(claimNoToken.status).toBe(403);
    expect(claimWrong.status).toBe(403);
    expect(await claimWrong.text()).toContain('The form has expired.');
    expect(statusOf(sending)).toBe('uploaded');

    await act(`/review/items/${sending.id}/claim`, s);
    const approve = await act(
      `/review/items/${sending.id}/approve`,
      s,
      { name: ADULT.name, kind: 'rg', number: ADULT.number, dateOfBirth: ADULT.dateOfBirth },
      '',
    );
    const reject = await act(`/review/items/${sending.id}/reject`, s, { reason: 'other' }, 'bogus');
    expect(approve.status).toBe(403);
    expect(reject.status).toBe(403);
    expect(statusOf(sending)).toBe('claimed');
    expect(eventOf(sending, 'approved')).toBeUndefined();
    expect(eventOf(sending, 'rejected')).toBeUndefined();
  });

  it('answers the page of a form whose token is right, with the token it used', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    await uploaded();
    const html = await (await getPage(h, '/review', asReviewer(s))).text();
    expect(csrfIn(html)).toBe(s.csrf);
  });
});

describe('the reviewer pages, in the browser language', () => {
  it('is in Portuguese for a Portuguese browser, English otherwise', async () => {
    await reviewer(h, 'rita');
    const s = await signIn(h, 'rita');
    const pt = await (
      await getPage(h, '/review', { ...asReviewer(s), 'accept-language': 'pt-BR,pt;q=0.9' })
    ).text();
    const en = await (await getPage(h, '/review', asReviewer(s))).text();
    expect(pt).toContain('<html lang="pt-BR">');
    expect(pt).toContain('Fila');
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('Queue');
  });
});
