import { escapeHtml, type Lang } from '../http';
import { UPLOAD_MESSAGES, type UploadRefusal } from '../uploadMessages';
import { UPLOAD_SCRIPT } from './uploadScript';
import { imageMegabytes } from './uploadRules';

/** The HTML of the upload page and of its three other answers. Everything dynamic is escaped on the way in. */

const STYLE = `
:root { color-scheme: light dark; --bg: #f4f4f2; --card: #fff; --text: #1c1a17; --muted: #6f6a61; --line: #ddd8cf; --accent: #0f766e; --accent-ink: #fff; --bad: #b3261e; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161514; --card: #201e1c; --text: #ece7df; --muted: #a8a094; --line: #3a3631; --accent: #5ec8bd; --accent-ink: #062926; --bad: #ff8a80; } }
:root[data-theme="dark"] { --bg: #161514; --card: #201e1c; --text: #ece7df; --muted: #a8a094; --line: #3a3631; --accent: #5ec8bd; --accent-ink: #062926; --bad: #ff8a80; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; font: 16px/1.45 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
main { max-width: 640px; margin: 0 auto; padding: 16px; }
h1 { font-size: 22px; margin: 12px 0 8px; }
h2 { font-size: 18px; margin: 0 0 8px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 12px 0; }
.lead { padding-left: 20px; margin: 0; }
.lead li { margin: 6px 0; }
.muted { color: var(--muted); font-size: 14px; }
.error { color: var(--bad); font-weight: 600; min-height: 1.4em; }
fieldset { min-width: 0; border: 1px solid var(--line); border-radius: 10px; margin: 12px 0; padding: 12px; }
legend { padding: 0 6px; font-weight: 600; }
label { display: block; margin: 8px 0; }
input[type=file] { font: inherit; margin-top: 4px; max-width: 100%; }
video, canvas { width: 100%; border-radius: 8px; background: #000; margin-bottom: 8px; }
button { font: inherit; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); width: 100%; font-weight: 600; }
button:disabled { opacity: .5; cursor: default; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.operator { color: var(--muted); font-size: 13px; margin-top: 24px; }
`;

/** One place for the page's document: the shell every answer shares. */
function shell(lang: Lang, nonce: string, title: string, body: string): string {
  const messages = UPLOAD_MESSAGES[lang];
  return (
    `<!doctype html><html lang="${lang === 'pt' ? 'pt-BR' : 'en'}"><head>` +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    `<title>${escapeHtml(title)}</title>` +
    `<style nonce="${nonce}">${STYLE}</style>` +
    `</head><body><main>${body}` +
    `<p class="operator">${escapeHtml(messages.operatorLabel)}</p>` +
    '</main></body></html>'
  );
}

export interface UploadPageInput {
  lang: Lang;
  nonce: string;
  /** `/v/<token>/upload`: where the form posts. */
  action: string;
  /** The per-image limit of this service, in bytes: the page says it. */
  maxImageBytes: number;
  /** The refusal of the last try, shown above the form. Absent on the first view. */
  refusal?: UploadRefusal;
}

/** The form. The camera box is hidden in the markup and shown by the script only where a camera can be used. */
export function uploadPage(input: UploadPageInput): string {
  const { lang, nonce, action, refusal } = input;
  const messages = UPLOAD_MESSAGES[lang];
  const errorText = refusal
    ? refusal === 'too_large'
      ? `${messages.refusals.too_large} ${messages.tooLargeNote.replace('{mb}', imageMegabytes(input.maxImageBytes))}`
      : messages.refusals[refusal]
    : '';
  const body =
    `<h1>${escapeHtml(messages.heading)}</h1>` +
    `<ul class="lead">${messages.lead.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` +
    `<form id="upload-form" class="card" method="post" action="${escapeHtml(action)}" enctype="multipart/form-data"` +
    ` data-network="${escapeHtml(messages.networkError)}"` +
    ` data-missing-front="${escapeHtml(messages.refusals.missing_front)}"` +
    ` data-missing-photo="${escapeHtml(messages.refusals.missing_photo)}">` +
    '<fieldset>' +
    `<legend>${escapeHtml(messages.frontLabel)}</legend>` +
    `<p class="muted">${escapeHtml(messages.frontHint)}</p>` +
    '<input id="front-file" type="file" name="front" accept="image/jpeg,image/png,image/webp" required>' +
    `<label>${escapeHtml(messages.backLabel)}<br>` +
    '<input id="back-file" type="file" name="back" accept="image/jpeg,image/png,image/webp"></label>' +
    '</fieldset>' +
    '<fieldset>' +
    `<legend>${escapeHtml(messages.photoHeading)}</legend>` +
    `<p class="muted">${escapeHtml(messages.photoHint)}</p>` +
    '<div id="camera-box" hidden>' +
    '<video id="preview" autoplay playsinline muted hidden></video>' +
    '<canvas id="snapshot" hidden></canvas>' +
    '<div class="actions">' +
    `<button type="button" id="camera-start">${escapeHtml(messages.cameraStart)}</button>` +
    `<button type="button" id="camera-capture" hidden>${escapeHtml(messages.cameraCapture)}</button>` +
    `<button type="button" id="camera-retake" hidden>${escapeHtml(messages.cameraRetake)}</button>` +
    '</div></div>' +
    '<div id="photo-fallback">' +
    `<label>${escapeHtml(messages.photoLabel)}<br>` +
    '<input id="photo-file" type="file" name="photo" accept="image/*" capture="user"></label>' +
    `<p class="muted">${escapeHtml(messages.photoFallback)}</p>` +
    '</div>' +
    '</fieldset>' +
    `<p id="form-error" class="error" role="alert">${escapeHtml(errorText)}</p>` +
    `<button id="send" class="primary" type="submit">${escapeHtml(messages.send)}</button>` +
    '</form>' +
    '<section id="done" class="card" hidden>' +
    `<h2>${escapeHtml(messages.done.heading)}</h2>` +
    `<p>${escapeHtml(messages.done.text)}</p>` +
    '</section>' +
    `<script nonce="${nonce}">${UPLOAD_SCRIPT}</script>`;
  return shell(lang, nonce, messages.title, body);
}

/** After a successful send, to a plain form post: the person can close the window. */
export function donePage(lang: Lang, nonce: string): string {
  const messages = UPLOAD_MESSAGES[lang];
  const body =
    `<h1>${escapeHtml(messages.done.heading)}</h1>` +
    `<section class="card"><p>${escapeHtml(messages.done.text)}</p></section>`;
  return shell(lang, nonce, messages.done.heading, body);
}

/**
 * The one answer for an unknown, used, expired or otherwise closed link. It depends on nothing but the language the
 * browser asks for, so the three cases cannot be told apart by what they show.
 */
export function invalidPage(lang: Lang, nonce: string): string {
  const messages = UPLOAD_MESSAGES[lang];
  const body =
    `<h1>${escapeHtml(messages.invalid.heading)}</h1>` +
    `<section class="card"><p>${escapeHtml(messages.invalid.text)}</p></section>`;
  return shell(lang, nonce, messages.invalid.heading, body);
}

export function rateLimitedPage(lang: Lang, nonce: string): string {
  const messages = UPLOAD_MESSAGES[lang];
  const body =
    `<h1>${escapeHtml(messages.heading)}</h1>` +
    `<section class="card"><p class="error">${escapeHtml(messages.refusals.rate_limited)}</p></section>`;
  return shell(lang, nonce, messages.title, body);
}
