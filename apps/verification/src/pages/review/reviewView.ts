import { REVIEWER_REJECTION_REASONS } from '../../decisions';
import { parseBlobs } from '../../store/blobs';
import type { SubmissionRow } from '../../store/submissions';
import { escapeHtml, type Lang } from '../http';
import { REVIEW_MESSAGES, type ReviewFlash, type ReviewMessages } from '../reviewMessages';
import { REVIEW_PATH } from './session';
import type { QueueRow } from './queries';

/**
 * The reviewer's HTML. Every page is a plain form or a list; the one script is none. Dynamic text is escaped on the way
 * in. The form of an approval is always rendered empty: what was typed is never sent back, not even after a refusal.
 */

const STYLE = `
:root { color-scheme: light dark; --bg: #f4f4f2; --card: #fff; --text: #1c1a17; --muted: #6f6a61; --line: #ddd8cf; --accent: #0f766e; --accent-ink: #fff; --bad: #b3261e; --ok: #1b7f4b; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161514; --card: #201e1c; --text: #ece7df; --muted: #a8a094; --line: #3a3631; --accent: #5ec8bd; --accent-ink: #062926; --bad: #ff8a80; --ok: #5fd196; } }
:root[data-theme="dark"] { --bg: #161514; --card: #201e1c; --text: #ece7df; --muted: #a8a094; --line: #3a3631; --accent: #5ec8bd; --accent-ink: #062926; --bad: #ff8a80; --ok: #5fd196; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; font: 15px/1.45 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
main { max-width: 760px; margin: 0 auto; padding: 16px; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
h1 { font-size: 20px; margin: 8px 0 4px; overflow-wrap: anywhere; }
h2 { font-size: 16px; margin: 0 0 8px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 12px 0; }
.muted { color: var(--muted); font-size: 13px; }
.notice { border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; }
.error { color: var(--bad); font-weight: 600; }
ul.rows { list-style: none; padding: 0; margin: 0; }
ul.rows li { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); padding: 10px 0; }
ul.rows li:first-child { border-top: 0; }
.cells { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; min-width: 0; }
.tag { display: inline-block; font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 0 8px; }
ol.checklist li { margin: 6px 0; }
figure { margin: 8px 0; }
figure img { display: block; width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); background: #000; }
figcaption { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
label { display: block; margin: 10px 0; font-size: 14px; }
input, select { font: inherit; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); margin-top: 4px; }
button, .link { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; text-decoration: none; display: inline-block; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
button.danger { border-color: var(--bad); color: var(--bad); }
form.inline { display: inline; margin: 0; }
.stack { display: grid; gap: 4px; }
`;

function shell(lang: Lang, nonce: string, title: string, body: string): string {
  return (
    `<!doctype html><html lang="${lang === 'pt' ? 'pt-BR' : 'en'}"><head>` +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    `<title>${escapeHtml(title)}</title>` +
    `<style nonce="${nonce}">${STYLE}</style>` +
    `</head><body><main>${body}</main></body></html>`
  );
}

/** A flash code from a query string, if it is one of ours. Anything else is ignored. */
export function flashOf(raw: string | null): ReviewFlash | undefined {
  const known: readonly string[] = [
    'approved',
    'rejected',
    'not-open',
    'not-claimed',
    'held-by-other',
    'retry-refused',
    'signed-out',
  ];
  return raw !== null && known.includes(raw) ? (raw as ReviewFlash) : undefined;
}

const notice = (text: string | undefined): string =>
  text ? `<p class="notice" role="status">${escapeHtml(text)}</p>` : '';

export interface LoginInput {
  lang: Lang;
  nonce: string;
  error?: 'invalid' | 'locked' | 'badForm';
  flash?: string | null;
}

export function loginHtml(input: LoginInput): string {
  const messages = REVIEW_MESSAGES[input.lang];
  const errorText = input.error
    ? input.error === 'invalid'
      ? messages.signIn.invalid
      : input.error === 'locked'
        ? messages.signIn.locked
        : messages.errors.badForm
    : undefined;
  const flash = flashOf(input.flash ?? null);
  const body =
    `<h1>${escapeHtml(messages.signIn.heading)}</h1>` +
    `<p class="muted">${escapeHtml(messages.operator)}</p>` +
    notice(flash ? messages.flash[flash] : undefined) +
    `<form class="card" method="post" action="/review/login" autocomplete="off">` +
    `<label>${escapeHtml(messages.signIn.name)}<input name="name" type="text" autocomplete="username" required maxlength="64"></label>` +
    `<label>${escapeHtml(messages.signIn.password)}<input name="password" type="password" autocomplete="current-password" required></label>` +
    `<p class="error" role="alert">${escapeHtml(errorText ?? '')}</p>` +
    `<button class="primary" type="submit">${escapeHtml(messages.signIn.submit)}</button>` +
    `</form>` +
    `<p class="muted">${escapeHtml(messages.signIn.note)}</p>`;
  return shell(input.lang, input.nonce, messages.signIn.heading, body);
}

const signOutForm = (messages: ReviewMessages, csrf: string): string =>
  `<form class="inline" method="post" action="/review/logout">` +
  `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">` +
  `<button type="submit">${escapeHtml(messages.signOut)}</button></form>`;

const header = (messages: ReviewMessages, csrf: string): string =>
  `<header><div class="stack"><h1>${escapeHtml(messages.title)}</h1>` +
  `<span class="muted">${escapeHtml(messages.operator)}</span></div>${signOutForm(messages, csrf)}</header>`;

const csrfField = (csrf: string): string =>
  `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`;

export interface QueueInput {
  lang: Lang;
  nonce: string;
  csrf: string;
  queue: QueueRow[];
  held: QueueRow[];
  flash?: string | null;
}

function queueRow(messages: ReviewMessages, row: QueueRow, csrf: string, held: boolean): string {
  const attempt = `${messages.queue.attempt} ${row.attempt}${row.retry ? ` (${messages.queue.retry})` : ''}`;
  const action = held
    ? `<a class="link" href="${REVIEW_PATH}/items/${encodeURIComponent(row.id)}">${escapeHtml(messages.queue.open)}</a>`
    : `<form class="inline" method="post" action="${REVIEW_PATH}/items/${encodeURIComponent(row.id)}/claim">` +
      `${csrfField(csrf)}<button class="primary" type="submit">${escapeHtml(messages.queue.claim)}</button></form>`;
  return (
    `<li><div class="cells">` +
    `<span>${escapeHtml(messages.queue.waiting)}: ${escapeHtml(messages.age(row.waitingMinutes))}</span>` +
    `<span class="tag">${escapeHtml(attempt)}</span>` +
    `<span>${escapeHtml(row.username)}</span>` +
    `</div>${action}</li>`
  );
}

export function queueHtml(input: QueueInput): string {
  const messages = REVIEW_MESSAGES[input.lang];
  const flash = flashOf(input.flash ?? null);
  const list = (rows: QueueRow[], held: boolean, empty: string): string =>
    rows.length === 0
      ? `<p class="muted">${escapeHtml(empty)}</p>`
      : `<ul class="rows">${rows.map((row) => queueRow(messages, row, input.csrf, held)).join('')}</ul>`;
  const body =
    header(messages, input.csrf) +
    notice(flash ? messages.flash[flash] : undefined) +
    `<section class="card"><h2>${escapeHtml(messages.queue.heading)}</h2>` +
    list(input.queue, false, messages.queue.empty) +
    `</section>` +
    (input.held.length > 0
      ? `<section class="card"><h2>${escapeHtml(messages.queue.heldHeading)}</h2>${list(input.held, true, '')}</section>`
      : '');
  return shell(input.lang, input.nonce, messages.queue.heading, body);
}

export interface ItemInput {
  lang: Lang;
  nonce: string;
  csrf: string;
  row: SubmissionRow;
  attempt: number;
  error?: 'underage' | 'invalidIdentity' | 'reasonNotSelectable' | 'badForm';
}

/** The item screen. The approval form is always empty: a refused approval gives the form back blank. */
export function itemHtml(input: ItemInput): string {
  const messages = REVIEW_MESSAGES[input.lang];
  const { row, csrf } = input;
  const base = `${REVIEW_PATH}/items/${encodeURIComponent(row.id)}`;
  const kinds = (Object.keys(messages.item.kinds) as (keyof ReviewMessages['item']['kinds'])[])
    .map((kind) => `<option value="${kind}">${escapeHtml(messages.item.kinds[kind])}</option>`)
    .join('');
  const reasons = REVIEWER_REJECTION_REASONS.map(
    (reason) =>
      `<option value="${reason}">${escapeHtml(messages.reasons[reason as keyof ReviewMessages['reasons']])}</option>`,
  ).join('');
  const errorText = input.error ? messages.errors[input.error] : '';
  // A back is optional at upload: the page shows one only where the stored metadata says the person sent one, rather
  // than a broken image where none exists.
  const hasBack = parseBlobs(row.blobsJson).some((blob) => blob.role === 'document-back');
  const backFigure = hasBack
    ? `<figure><figcaption>${escapeHtml(messages.item.images.back)}</figcaption>` +
      `<img src="${base}/doc/2" alt="${escapeHtml(messages.item.images.back)}" width="1200" height="800"></figure>`
    : '';
  const body =
    `<p><a class="link" href="${REVIEW_PATH}">${escapeHtml(messages.item.back)}</a></p>` +
    `<header><div class="stack"><h1>${escapeHtml(messages.item.heading)}: ${escapeHtml(row.subjectUsername)}</h1>` +
    `<span class="muted">${escapeHtml(messages.item.attemptLabel)} ${input.attempt}${row.retryOf ? ` (${escapeHtml(messages.queue.retry)})` : ''}</span></div>` +
    `${signOutForm(messages, csrf)}</header>` +
    `<p class="error" role="alert">${escapeHtml(errorText)}</p>` +
    `<section class="card"><h2>${escapeHtml(messages.item.checklistHeading)}</h2>` +
    `<ol class="checklist">${messages.item.checklist.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` +
    `<p class="muted">${escapeHtml(messages.item.handbookNote)}</p></section>` +
    `<section class="card">` +
    `<figure><figcaption>${escapeHtml(messages.item.images.front)}</figcaption>` +
    `<img src="${base}/doc/1" alt="${escapeHtml(messages.item.images.front)}" width="1200" height="800"></figure>` +
    backFigure +
    `<figure><figcaption>${escapeHtml(messages.item.images.photo)}</figcaption>` +
    `<img src="${base}/photo" alt="${escapeHtml(messages.item.images.photo)}" width="1200" height="800"></figure>` +
    `</section>` +
    `<section class="card"><h2>${escapeHtml(messages.item.approveHeading)}</h2>` +
    `<p class="muted">${escapeHtml(messages.item.approveNote)}</p>` +
    `<form method="post" action="${base}/approve" autocomplete="off">${csrfField(csrf)}` +
    `<label>${escapeHtml(messages.item.name)}<input name="name" type="text" required maxlength="200" autocomplete="off" spellcheck="false"></label>` +
    `<label>${escapeHtml(messages.item.kind)}<select name="kind" required>${kinds}</select></label>` +
    `<label>${escapeHtml(messages.item.number)}<input name="number" type="text" required maxlength="64" autocomplete="off" spellcheck="false"></label>` +
    `<label>${escapeHtml(messages.item.dateOfBirth)}<input name="dateOfBirth" type="date" required autocomplete="off"></label>` +
    `<button class="primary" type="submit">${escapeHtml(messages.item.approve)}</button></form></section>` +
    `<section class="card"><h2>${escapeHtml(messages.item.refuseHeading)}</h2>` +
    `<form method="post" action="${base}/reject">${csrfField(csrf)}` +
    `<label>${escapeHtml(messages.item.reason)}<select name="reason" required>${reasons}</select></label>` +
    `<button class="danger" type="submit">${escapeHtml(messages.item.refuse)}</button></form></section>`;
  return shell(input.lang, input.nonce, `${messages.item.heading}`, body);
}

/** A short page for a refusal or a missing thing: no content, only what happened. */
export function messagePage(lang: Lang, nonce: string, text: string): string {
  const messages = REVIEW_MESSAGES[lang];
  return shell(
    lang,
    nonce,
    messages.title,
    `<h1>${escapeHtml(messages.title)}</h1><p class="error" role="alert">${escapeHtml(text)}</p>` +
      `<p><a class="link" href="${REVIEW_PATH}">${escapeHtml(messages.item.back)}</a></p>`,
  );
}
