import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBlob } from '../../src/store/blobs';
import { bytesContain, harness, type Harness, T0 } from '../helpers/harness';
import {
  bytesOf,
  fileOf,
  getPage,
  goodParts,
  HTML_ACCEPT,
  JSON_ACCEPT,
  jpegOf,
  nonceOf,
  pngOf,
  postPage,
  type Sending,
  startSending,
  uploadForm,
  uploadTo,
  webpOf,
  withoutNonce,
} from './helpers';

const DAY = 24 * 60 * 60 * 1000;

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  h.close();
});

const rowOf = (sending: Sending) => h.state.stores.submissions.byId(sending.id);

describe('the upload page (GET /v/:token)', () => {
  it('is in the language the sending was made in, whatever the browser asks for', async () => {
    const sending = await startSending(h, { language: 'pt-BR' });
    const response = await getPage(h, `/v/${sending.token}`, {
      'accept-language': 'en-US,en;q=0.9',
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('Verificação de idade');
    expect(html).not.toContain('Verify your age');
  });

  it('is in English for an English sending, and follows the browser only when the sending has no usable language', async () => {
    const english = await startSending(h, { language: 'en' });
    const englishHtml = await (await getPage(h, `/v/${english.token}`)).text();
    expect(englishHtml).toContain('<html lang="en">');
    expect(englishHtml).toContain('Verify your age');

    // A language the service does not have: the browser decides, and Portuguese is asked for here.
    const other = await startSending(h, { language: 'fr', userId: 'user-fr' });
    const asked = await (
      await getPage(h, `/v/${other.token}`, { 'accept-language': 'fr;q=1, pt;q=0.5' })
    ).text();
    expect(asked).toContain('Verificação de idade');
    // Nothing asked and nothing stored: English.
    const fallback = await (
      await getPage(h, `/v/${other.token}`, { 'accept-language': 'de' })
    ).text();
    expect(fallback).toContain('Verify your age');
  });

  it('answers with the policy: one nonce for the only inline script and style, no unsafe-inline, no framing, no referrer', async () => {
    const sending = await startSending(h);
    const response = await getPage(h, `/v/${sending.token}`);
    const html = await response.text();
    const policy = response.headers.get('content-security-policy') ?? '';
    const nonce = nonceOf(response);
    expect(policy).toContain(`style-src 'nonce-${nonce}'`);
    expect(policy).toContain(`script-src 'nonce-${nonce}'`);
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).toContain("default-src 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('permissions-policy')).toContain('camera=(self)');
    expect(html).toContain(`<style nonce="${nonce}">`);
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toMatch(/ style="/);
  });

  it('gives the same page for an unknown link, a used one and an expired one', async () => {
    const sending = await startSending(h);
    const unknown = await getPage(h, '/v/this-link-was-never-issued-0123456789');
    const unknownHtml = await unknown.text();

    const used = await uploadTo(h, sending.token);
    expect(used.status).toBe(200);
    const usedResponse = await getPage(h, `/v/${sending.token}`);
    const usedHtml = await usedResponse.text();

    const expiring = await startSending(h, { userId: 'user-old' });
    h.setNow(T0 + 31 * DAY);
    const expired = await getPage(h, `/v/${expiring.token}`);
    const expiredHtml = await expired.text();

    for (const response of [unknown, usedResponse, expired]) {
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    }
    expect(unknownHtml).toContain('This link is no longer valid');
    expect(withoutNonce(usedHtml)).toBe(withoutNonce(unknownHtml));
    expect(withoutNonce(expiredHtml)).toBe(withoutNonce(unknownHtml));
  });

  it('refuses the view when one address asks too often (no walking of the links)', async () => {
    const sending = await startSending(h);
    let last = 0;
    for (let i = 0; i < 61; i += 1) last = (await getPage(h, `/v/${sending.token}`)).status;
    expect(last).toBe(429);
  });
});

describe('the upload (POST /v/:token/upload)', () => {
  it('stores three sealed images, marks the sending uploaded, and leaves no plaintext in the data or the keys', async () => {
    const sending = await startSending(h, { language: 'en' });
    const response = await uploadTo(h, sending.token);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('You can close this window');
    expect(html).not.toContain('<form');

    const row = rowOf(sending);
    expect(row?.status).toBe('uploaded');
    expect(row?.uploadedAt).toBe(T0);
    const roles = (row?.blobsJson ? JSON.parse(row.blobsJson) : []) as { role: string }[];
    expect(roles.map((blob) => blob.role).sort()).toEqual([
      'document-back',
      'document-front',
      'photo',
    ]);

    // The ciphertext is on disk, and it opens to what was sent with the key the store holds.
    const front = readBlob(h.state.stores, sending.id, 'document-front');
    expect(bytesOf(front ?? new Uint8Array()).equals(bytesOf(jpegOf('FRONT-PLAIN-x-7741')))).toBe(
      true,
    );
    expect(readBlob(h.state.stores, sending.id, 'photo')).toBeDefined();

    // The plaintext appears nowhere under DATA_DIR or KEY_DIR: neither the images nor their magic-prefixed bytes.
    for (const text of ['FRONT-PLAIN-x-7741', 'BACK-PLAIN-x-7742', 'PHOTO-PLAIN-x-7743']) {
      expect(bytesContain(h.root, Buffer.from(text))).toBe(false);
    }
  });

  it('answers a script with JSON, and burns the link: a second upload and a second visit are the invalid page', async () => {
    const sending = await startSending(h);
    const first = await postPage(
      h,
      `/v/${sending.token}/upload`,
      uploadForm(goodParts()),
      JSON_ACCEPT,
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });

    const second = await postPage(
      h,
      `/v/${sending.token}/upload`,
      uploadForm(goodParts('again')),
      JSON_ACCEPT,
    );
    expect(second.status).toBe(404);
    expect(await second.json()).toMatchObject({ ok: false, code: 'invalid' });
    const visit = await getPage(h, `/v/${sending.token}`);
    expect(visit.status).toBe(404);
    // The first upload's photo is what is kept: the second post stored nothing.
    const photo = bytesOf(readBlob(h.state.stores, sending.id, 'photo') ?? new Uint8Array());
    expect(photo.includes(Buffer.from('PHOTO-PLAIN-x-7743'))).toBe(true);
    expect(photo.includes(Buffer.from('again'))).toBe(false);
  });

  it('refuses what is not a JPEG, PNG or WebP by its bytes: HTML, SVG, GIF, PDF, and a text dressed as a PNG', async () => {
    const cases: [string, Uint8Array][] = [
      ['HTML', Buffer.from('<!doctype html><script>alert(1)</script>')],
      [
        'SVG',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      ],
      ['GIF', Buffer.from('GIF89a-plain-gif-bytes')],
      ['PDF', Buffer.from('%PDF-1.7 plain pdf bytes')],
      ['text as png', Buffer.from('just text, named like a picture')],
    ];
    for (const [label, bytes] of cases) {
      const sending = await startSending(h, { userId: `user-${label}` });
      const response = await postPage(
        h,
        `/v/${sending.token}/upload`,
        uploadForm({
          front: fileOf(bytes, 'front.png', 'image/png'),
          photo: fileOf(jpegOf('PHOTO-OK'), 'photo.jpg', 'image/jpeg'),
        }),
        JSON_ACCEPT,
      );
      expect(response.status, label).toBe(400);
      expect(await response.json(), label).toMatchObject({ ok: false, code: 'not_an_image' });
      expect(rowOf(sending)?.status, label).toBe('pending');
      expect(rowOf(sending)?.blobsJson, label).toBeNull();
    }
  });

  it('refuses an image over the per-image limit, and says so; the link stays open for another try', async () => {
    const small = harness({ env: { MAX_UPLOAD_BYTES: '1000' } });
    try {
      const sending = await startSending(small);
      const big = fileOf(jpegOf('x'.repeat(1100)), 'front.jpg', 'image/jpeg');
      const response = await postPage(
        small,
        `/v/${sending.token}/upload`,
        uploadForm({ front: big, photo: fileOf(jpegOf('p'), 'p.jpg', 'image/jpeg') }),
        JSON_ACCEPT,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, code: 'too_large' });
      expect(small.state.stores.submissions.byId(sending.id)?.status).toBe('pending');

      // The same link takes a smaller set afterwards.
      const retry = await postPage(
        small,
        `/v/${sending.token}/upload`,
        uploadForm({
          front: fileOf(jpegOf('f'), 'f.jpg', 'image/jpeg'),
          photo: fileOf(jpegOf('p'), 'p.jpg', 'image/jpeg'),
        }),
        JSON_ACCEPT,
      );
      expect(await retry.json()).toEqual({ ok: true });
    } finally {
      small.close();
    }
  });

  it('refuses a request declared larger than the total cap, before reading it', async () => {
    const sending = await startSending(h);
    const response = await postPage(h, `/v/${sending.token}/upload`, 'x', {
      ...JSON_ACCEPT,
      'content-length': String(64 * 1024 * 1024),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'request_too_large' });
    expect(rowOf(sending)?.status).toBe('pending');
  });

  it('needs a front and a photo, takes at most one of each, and nothing else', async () => {
    const sending = await startSending(h);
    const photo = fileOf(jpegOf('p'), 'p.jpg', 'image/jpeg');
    const front = fileOf(jpegOf('f'), 'f.jpg', 'image/jpeg');
    const answer = async (parts: Parameters<typeof uploadForm>[0]) => {
      const response = await postPage(
        h,
        `/v/${sending.token}/upload`,
        uploadForm(parts),
        JSON_ACCEPT,
      );
      return { status: response.status, body: (await response.json()) as { code?: string } };
    };
    expect(await answer({ photo })).toEqual({
      status: 400,
      body: expect.objectContaining({ code: 'missing_front' }),
    });
    expect(await answer({ front })).toEqual({
      status: 400,
      body: expect.objectContaining({ code: 'missing_photo' }),
    });
    expect(
      await answer({ front, photo, extra: fileOf(jpegOf('e'), 'e.jpg', 'image/jpeg') }),
    ).toEqual({
      status: 400,
      body: expect.objectContaining({ code: 'unexpected_field' }),
    });
    expect(
      await answer({
        front,
        photo,
        repeat: [['front', fileOf(jpegOf('g'), 'g.jpg', 'image/jpeg')]],
      }),
    ).toEqual({
      status: 400,
      body: expect.objectContaining({ code: 'too_many' }),
    });
    expect(rowOf(sending)?.status).toBe('pending');
  });

  it('an empty file input is no file: an empty back is simply absent, and the form still goes', async () => {
    const sending = await startSending(h);
    const response = await postPage(
      h,
      `/v/${sending.token}/upload`,
      uploadForm({
        front: fileOf(jpegOf('f-empty-back'), 'f.jpg', 'image/jpeg'),
        back: new File([], '', { type: 'application/octet-stream' }),
        photo: fileOf(webpOf('p-empty-back'), 'p.webp', 'image/webp'),
      }),
      JSON_ACCEPT,
    );
    expect(await response.json()).toEqual({ ok: true });
    const roles = JSON.parse(rowOf(sending)?.blobsJson ?? '[]') as { role: string }[];
    expect(roles.map((blob) => blob.role).sort()).toEqual(['document-front', 'photo']);
  });

  it('accepts a PNG and a WebP as well as a JPEG, and stores each with the type its bytes have', async () => {
    const sending = await startSending(h);
    await uploadTo(h, sending.token, {
      front: fileOf(pngOf('png-front-type'), 'f.png', 'image/png'),
      photo: fileOf(webpOf('webp-photo-type'), 'p.webp', 'image/webp'),
    });
    const blobs = JSON.parse(rowOf(sending)?.blobsJson ?? '[]') as {
      role: string;
      contentType: string;
    }[];
    expect(Object.fromEntries(blobs.map((blob) => [blob.role, blob.contentType]))).toEqual({
      'document-front': 'image/png',
      photo: 'image/webp',
    });
  });

  it('refuses an expired link without storing anything', async () => {
    const sending = await startSending(h);
    h.setNow(T0 + 31 * DAY);
    const response = await postPage(
      h,
      `/v/${sending.token}/upload`,
      uploadForm(goodParts()),
      JSON_ACCEPT,
    );
    expect(response.status).toBe(404);
    expect(rowOf(sending)?.status).toBe('pending');
    expect(rowOf(sending)?.blobsJson).toBeNull();
  });

  it('refuses a post from another site (Origin), and a post that is not a form', async () => {
    const sending = await startSending(h);
    const foreign = await postPage(h, `/v/${sending.token}/upload`, uploadForm(goodParts()), {
      ...HTML_ACCEPT,
      origin: 'https://evil.example',
    });
    expect(foreign.status).toBe(403);
    const notForm = await postPage(h, `/v/${sending.token}/upload`, '{"front":1}', {
      'content-type': 'application/json',
      ...JSON_ACCEPT,
    });
    expect(await notForm.json()).toMatchObject({ code: 'bad_request' });
    expect(rowOf(sending)?.status).toBe('pending');
  });

  it('rate-limits the upload route by address', async () => {
    let last = 0;
    for (let i = 0; i < 21; i += 1) {
      last = (
        await postPage(h, '/v/no-such-link-0123456789abcdefghij/upload', undefined, JSON_ACCEPT)
      ).status;
    }
    expect(last).toBe(429);
  });

  it('answers a page with the same nonce in its policy and its markup', async () => {
    const sending = await startSending(h);
    const response = await uploadTo(h, sending.token);
    expect(nonceOf(response).length).toBeGreaterThan(10);
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-inline');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps the form and says why, in the page language, when a plain post is refused', async () => {
    const sending = await startSending(h, { language: 'en' });
    const response = await postPage(
      h,
      `/v/${sending.token}/upload`,
      uploadForm({
        front: fileOf(Buffer.from('<html>'), 'f.html', 'text/html'),
        photo: fileOf(jpegOf('p'), 'p.jpg', 'image/jpeg'),
      }),
      HTML_ACCEPT,
    );
    const html = await response.text();
    expect(response.status).toBe(400);
    expect(html).toContain('Send a JPEG, PNG or WebP image.');
    expect(html).toContain('<form id="upload-form"');
    expect(html).not.toContain('<html>'); // the refused bytes are never echoed
  });
});
