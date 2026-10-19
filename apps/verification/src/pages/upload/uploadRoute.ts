import { hashUploadToken, newUploadToken } from '../../crypto/token';
import type { PageRoute, ServiceState } from '../../routes';
import { BlobRefused, storeBlob } from '../../store/blobs';
import type { SubmissionRow } from '../../store/submissions';
import {
  bareResponse,
  clientAddress,
  htmlResponse,
  type Lang,
  newNonce,
  sameOriginOrAbsent,
  wantsJson,
} from '../http';
import { pageLanguage } from '../language';
import { limitsOf } from '../limits';
import { UPLOAD_MESSAGES, type UploadRefusal } from '../uploadMessages';
import { FORM_OVERHEAD_BYTES, readUpload, totalUploadBytes } from './uploadRules';
import { donePage, invalidPage, rateLimitedPage, uploadPage } from './uploadView';

/**
 * The person's side of a sending: `GET /v/<token>` shows the upload page, `POST /v/<token>/upload` takes the images.
 * A link is valid only while its sending is `pending` and not expired. Every other case - unknown, used, expired -
 * gets the same answer, so the links cannot be probed. A successful upload burns the link (its token hash is replaced,
 * so no copy of it opens anything again) and moves the sending to `uploaded`.
 */

const VIEW_PATH = /^\/v\/([^/]+)$/;
const UPLOAD_PATH = /^\/v\/([^/]+)\/upload$/;
const MAX_TOKEN_LENGTH = 200;

/** The sending a link opens, or undefined: the link must name a pending sending that has not run out. */
export function openSubmissionFor(state: ServiceState, token: string): SubmissionRow | undefined {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return undefined;
  const row = state.stores.submissions.byUploadTokenHash(hashUploadToken(token));
  if (!row || row.status !== 'pending' || row.expiresAt <= state.clock()) return undefined;
  return row;
}

export const uploadRoute: PageRoute = async (request, url, state) => {
  const view = VIEW_PATH.exec(url.pathname);
  if (view && request.method === 'GET') return showPage(request, state, view[1] ?? '');
  const upload = UPLOAD_PATH.exec(url.pathname);
  if (upload && request.method === 'POST') return receive(request, state, upload[1] ?? '');
  return undefined;
};

/** What one request needs to answer: who asks, the link it used, and the limit it is held to. */
interface Exchange {
  request: Request;
  token: string;
  nonce: string;
  json: boolean;
  maxImageBytes: number;
}

/** The language of an answer: the sending's stored one when there is a sending, else the browser's. */
function languageOf(request: Request, row: SubmissionRow | undefined): Lang {
  return pageLanguage(row?.language, request.headers.get('accept-language'));
}

function jsonAnswer(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}

async function showPage(request: Request, state: ServiceState, token: string): Promise<Response> {
  const nonce = newNonce();
  if (!limitsOf(state).uploadView.allow(clientAddress(request), state.clock())) {
    return htmlResponse(429, rateLimitedPage(languageOf(request, undefined), nonce), nonce);
  }
  const row = openSubmissionFor(state, token);
  if (!row) return htmlResponse(404, invalidPage(languageOf(request, undefined), nonce), nonce);
  const page = uploadPage({
    lang: languageOf(request, row),
    nonce,
    action: `/v/${token}/upload`,
    maxImageBytes: state.config.maxUploadBytes,
  });
  return htmlResponse(200, page, nonce, { camera: true });
}

async function receive(request: Request, state: ServiceState, token: string): Promise<Response> {
  const exchange: Exchange = {
    request,
    token,
    nonce: newNonce(),
    json: wantsJson(request),
    maxImageBytes: state.config.maxUploadBytes,
  };
  const now = state.clock();

  if (!limitsOf(state).uploadPost.allow(clientAddress(request), now)) {
    return refusal(exchange, undefined, 'rate_limited', 429);
  }
  if (!sameOriginOrAbsent(request, state.config.publicUrl)) return bareResponse(403);
  // Refused before the body is read: a declared size that no upload of ours could have.
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > totalUploadBytes(state.config.maxUploadBytes) + FORM_OVERHEAD_BYTES) {
    return refusal(exchange, openSubmissionFor(state, token), 'request_too_large', 413);
  }

  const before = openSubmissionFor(state, token);
  if (!before) return invalidAnswer(exchange, undefined);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refusal(exchange, before, 'bad_request', 400);
  }
  const reading = await readUpload(form, state.config.maxUploadBytes);
  if (!reading.ok) return refusal(exchange, before, reading.refusal, 400);

  // The body took time to read, so the link is checked again. From here to the burn nothing awaits: no other upload of
  // the same link can interleave with the storing and the status change.
  const row = openSubmissionFor(state, token);
  if (!row) return invalidAnswer(exchange, undefined);
  try {
    for (const image of reading.images) {
      storeBlob(state.stores, row.id, {
        role: image.role,
        plain: image.bytes,
        contentType: image.contentType,
        maxBytes: state.config.maxUploadBytes,
      });
    }
  } catch (error) {
    if (!(error instanceof BlobRefused)) throw error;
    return refusal(exchange, row, 'unexpected', 500);
  }
  state.stores.submissions.markUploaded(row.id, now);
  // Burn the link: its token hash is replaced by the hash of a token nobody was ever given.
  state.stores.submissions.setUploadTokenHash(row.id, newUploadToken().hash);

  if (exchange.json) return jsonAnswer({ ok: true }, 200);
  return htmlResponse(200, donePage(languageOf(request, row), exchange.nonce), exchange.nonce);
}

/** The answer for a closed link: the same page a bad link gets, or the same code for the script. */
function invalidAnswer(exchange: Exchange, row: SubmissionRow | undefined): Response {
  const lang = languageOf(exchange.request, row);
  if (exchange.json) {
    return jsonAnswer(
      { ok: false, code: 'invalid', message: UPLOAD_MESSAGES[lang].refusals.invalid },
      404,
    );
  }
  return htmlResponse(404, invalidPage(lang, exchange.nonce), exchange.nonce);
}

/**
 * A refused upload. The link stays open (the person may send again): a plain form post gets the upload page back with
 * the reason above the form, the script gets the reason as JSON. Nothing the person sent is echoed back.
 */
function refusal(
  exchange: Exchange,
  row: SubmissionRow | undefined,
  code: UploadRefusal,
  status: number,
): Response {
  const { request, nonce, json, token, maxImageBytes } = exchange;
  const lang = languageOf(request, row);
  if (json) {
    return jsonAnswer({ ok: false, code, message: UPLOAD_MESSAGES[lang].refusals[code] }, status);
  }
  if (code === 'rate_limited') return htmlResponse(status, rateLimitedPage(lang, nonce), nonce);
  if (!row) return htmlResponse(404, invalidPage(lang, nonce), nonce);
  const page = uploadPage({
    lang,
    nonce,
    action: `/v/${token}/upload`,
    maxImageBytes,
    refusal: code,
  });
  return htmlResponse(status, page, nonce, { camera: true });
}
