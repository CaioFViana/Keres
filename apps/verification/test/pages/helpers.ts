import { addReviewer } from '../../src/cli/addReviewer';
import { csrfFor } from '../../src/pages/review/session';
import { PUBLIC_URL, type Harness, ORIGIN, signedCall } from '../helpers/harness';

/**
 * Helpers of the page tests: distinctive image bytes (so a scan of the files can tell plaintext from ciphertext), a
 * multipart builder, a sending made through the signed protocol, and a reviewer signed in through the form.
 */

export const REVIEWER_PASSWORD = 'correct horse battery staple';

const withMagic = (magic: number[], text: string): Uint8Array =>
  Buffer.concat([Buffer.from(magic), Buffer.from(text, 'utf8')]);

/** A JPEG by its first bytes, then a marker no ciphertext could contain. */
export const jpegOf = (text: string): Uint8Array => withMagic([0xff, 0xd8, 0xff, 0xe0], text);

/** A PNG by its signature, then the marker. */
export const pngOf = (text: string): Uint8Array =>
  withMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], text);

/** A WebP: RIFF, a size, WEBP, then the marker. */
export const webpOf = (text: string): Uint8Array =>
  Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('WEBP'),
    Buffer.from(text),
  ]);

export const bytesOf = (value: Uint8Array): Buffer => Buffer.from(value);

export function fileOf(bytes: Uint8Array, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

export interface Parts {
  front?: File | string;
  back?: File | string;
  photo?: File | string;
  extra?: File | string;
  /** Appended as they are, for the refusals that need a second file in a field. */
  repeat?: Array<[string, File]>;
}

/** The multipart form of an upload: one field per part given. */
export function uploadForm(parts: Parts): FormData {
  const form = new FormData();
  for (const name of ['front', 'back', 'photo', 'extra'] as const) {
    const value = parts[name];
    if (value !== undefined) form.append(name, value);
  }
  for (const [name, file] of parts.repeat ?? []) form.append(name, file);
  return form;
}

export interface Sending {
  id: string;
  token: string;
  providerReference: string;
  verificationId: string;
}

let counter = 0;

/** Starts a sending through the signed `/v1` call and returns its link's token and its ids. */
export async function startSending(
  h: Harness,
  options: {
    userId?: string;
    username?: string;
    language?: string;
    retryOf?: string;
    verificationId?: string;
  } = {},
): Promise<Sending> {
  counter += 1;
  const verificationId = options.verificationId ?? `verification-${counter}`;
  const answer = await signedCall(h, 'POST', '/v1/verifications', {
    body: {
      verificationId,
      subject: { userId: options.userId ?? `user-${counter}`, username: options.username ?? 'ana' },
      language: options.language ?? 'pt-BR',
      ...(options.retryOf ? { retryOf: options.retryOf } : {}),
    },
  });
  if (answer.status !== 200) throw new Error(`Starting a sending failed: ${answer.status}`);
  const body = answer.json as { providerReference: string; action: { url: string } };
  const row = h.state.stores.submissions.byVerificationId(verificationId);
  if (!row) throw new Error('The sending was not stored.');
  return {
    id: row.id,
    token: body.action.url.slice(`${PUBLIC_URL}/v/`.length),
    providerReference: body.providerReference,
    verificationId,
  };
}

/** A well-formed upload of one front, one back and one photo. */
export function goodParts(tag = 'x'): Parts {
  return {
    front: fileOf(jpegOf(`FRONT-PLAIN-${tag}-7741`), 'front.jpg', 'image/jpeg'),
    back: fileOf(pngOf(`BACK-PLAIN-${tag}-7742`), 'back.png', 'image/png'),
    photo: fileOf(webpOf(`PHOTO-PLAIN-${tag}-7743`), 'photo.webp', 'image/webp'),
  };
}

/** A POST to a page path on the service, with the headers given. */
export function postPage(
  h: Harness,
  path: string,
  body: FormData | URLSearchParams | string | undefined,
  headers: Record<string, string> = {},
): Promise<Response> {
  return h.app.fetch(new Request(`${ORIGIN}${path}`, { method: 'POST', body, headers }));
}

export function getPage(
  h: Harness,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return h.app.fetch(new Request(`${ORIGIN}${path}`, { method: 'GET', headers }));
}

/** The upload link's answer, with the Accept header of a plain form post or of the page's script. */
export const HTML_ACCEPT = { accept: 'text/html' };
export const JSON_ACCEPT = { accept: 'application/json' };

/** The nonce of an HTML answer, from its own CSP header (every answer names one). */
export function nonceOf(response: Response): string {
  const policy = response.headers.get('content-security-policy') ?? '';
  const match = /script-src 'nonce-([^']+)'/.exec(policy);
  if (!match) throw new Error('No nonce in the policy.');
  return match[1] ?? '';
}

/** The same page with the nonce removed, so two answers can be compared as what they show. */
export const withoutNonce = (html: string): string => html.replace(/nonce="[^"]*"/g, 'nonce=""');

/** The first CSRF token of a page (every form of the reviewer pages carries the same one). */
export function csrfIn(html: string): string {
  const match = /name="csrf" value="([^"]+)"/.exec(html);
  if (!match) throw new Error('No CSRF token in the page.');
  return match[1] ?? '';
}

/** Adds a reviewer with the test password and returns the name. */
export async function reviewer(h: Harness, name: string): Promise<string> {
  await addReviewer(h.state.stores, name, REVIEWER_PASSWORD, h.now());
  return name;
}

export interface Signed {
  cookie: string;
  token: string;
  csrf: string;
}

/**
 * Signs a reviewer in through the form and returns the session cookie. `ip` is the address the login counts by (the
 * forwarded one), so two reviewers on two addresses never share a lockout.
 */
export async function signIn(
  h: Harness,
  name: string,
  password = REVIEWER_PASSWORD,
  ip = '198.51.100.10',
): Promise<Signed> {
  const response = await postPage(h, '/review/login', new URLSearchParams({ name, password }), {
    'content-type': 'application/x-www-form-urlencoded',
    'x-forwarded-for': ip,
  });
  const cookie = response.headers.get('set-cookie') ?? '';
  const match = /keres_review_session=([^;]+)/.exec(cookie);
  if (response.status !== 303 || !match) throw new Error(`Sign-in failed: ${response.status}`);
  const token = match[1] ?? '';
  return { cookie: `keres_review_session=${token}`, token, csrf: csrfFor(token) };
}

/** A GET with the signed-in session's cookie. */
export const asReviewer = (signedIn: Signed): Record<string, string> => ({
  cookie: signedIn.cookie,
});

/** Uploads good images to a link through the page, as a plain form post. Returns the response. */
export function uploadTo(h: Harness, token: string, parts: Parts = goodParts()): Promise<Response> {
  return postPage(h, `/v/${token}/upload`, uploadForm(parts), HTML_ACCEPT);
}
