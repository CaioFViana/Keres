/**
 * Raises the Keres API and the reference age-verification service side by side, with throwaway values, so the whole
 * age-verification path can be tried on one machine without touching any `.env`:
 *
 *   bun run verification:local            start both, create a reviewer, stay up (Ctrl+C stops both)
 *   bun run verification:local --drive    start both, drive the whole flow over HTTP, print PASS/FAIL per step,
 *                                         stop both and exit non-zero on the first failed step
 *   bun scripts/age-verification-local.ts --mode=disabled
 *                                         start only the API, with verification off (no service, no reviewer);
 *                                         with --drive, checks the answers a disabled server gives, then stops.
 *                                         `--mode=required` is the default.
 *
 * What it sets up (see docs/age_verification.md, "Trying it locally"):
 *   - the verification service on 127.0.0.1:3102 (or the next free port), with DATA_DIR and KEY_DIR as two sibling
 *     temporary folders under the OS temp folder: the keys never sit beside the data they protect;
 *   - the Keres API on 127.0.0.1:3301 (or the next free port) in `AGE_VERIFICATION_MODE=required`, with a temporary
 *     SQLite file and an administrator `root` with a random password;
 *   - the secrets, random for this run and matched in pairs: what Keres signs with is what the service checks, and
 *     the events key is the one Keres checks (the two directions never share a key);
 *   - one reviewer for the service, created with the service's own CLI and a random password.
 * Nothing leaves the machine and no .env file is read or written. The API does read apps/api/.env when it boots (the
 * server always does), and a value that is already in the environment wins over it, so the payment connector keys
 * are emptied here and every age-verification key is set explicitly.
 *
 * Ports 3000 (the developer's own server), 3300 (the payments test stack) and 3101 (its payments service) are never used.
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const drive = process.argv.includes('--drive');
// `disabled` runs the API alone, as a server with no age verification runs (see "Modes" in docs/age_verification.md).
const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument ? modeArgument.slice('--mode='.length) : 'required';
if (mode !== 'required' && mode !== 'disabled') {
  console.error(`--mode must be required or disabled, not ${mode}.`);
  process.exit(1);
}
const disabled = mode === 'disabled';
// In the drive, the children's logs stay quiet; they are printed only when a step fails.
const verbose = !drive;

const FORBIDDEN_PORTS = [3000, 3101, 3300];
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

/** A 1x1 PNG: a real image by its bytes, which is all the service checks (JPEG, PNG or WebP are accepted). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
/** What the reviewer types for the approval. The same triple is used twice, to prove the duplicate check. */
const IDENTITY = { name: 'Maria Exemplo Teste', kind: 'rg', number: '12.345.678-9' };
const ADULT_BIRTH_DATE = '1990-05-17';

const secret = (): string => randomBytes(32).toString('base64url');
const suffix = (): string => randomBytes(4).toString('hex');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null;
/** A field of a parsed answer, or undefined: the answers are read as data, never trusted to have a shape. */
function dig(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  return current;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

interface Options {
  token?: string;
  cookie?: string;
  json?: unknown;
  form?: Record<string, string>;
  multipart?: FormData;
  accept?: string;
}

interface Answer {
  status: number;
  headers: Headers;
  bytes: Buffer;
  text: string;
  body: unknown;
}

/**
 * One HTTP exchange. Redirects are not followed: the reviewer pages answer a post with a redirect, and that answer is
 * what the drive checks.
 */
async function send(method: string, url: string, options: Options = {}): Promise<Answer> {
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.accept) headers.set('accept', options.accept);
  let body: string | FormData | undefined;
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  } else if (options.form) {
    headers.set('content-type', 'application/x-www-form-urlencoded');
    body = new URLSearchParams(options.form).toString();
  } else if (options.multipart) {
    body = options.multipart;
  }
  const response = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  return { status: response.status, headers: response.headers, bytes, text, body: parsed };
}

/** The `keres_review_session` cookie of an answer, ready to be sent back as a `Cookie` header. */
function sessionCookieOf(answer: Answer): string | undefined {
  for (const line of answer.headers.getSetCookie()) {
    const pair = line.split(';')[0] ?? '';
    if (pair.startsWith('keres_review_session=')) return pair;
  }
  return undefined;
}

/** Polls until `attempt` returns a value. Fails when the time runs out. */
async function poll<T>(
  what: string,
  attempt: () => Promise<T | undefined>,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await attempt();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) {
      throw new Error(`${what} did not happen within ${Math.round(timeoutMs / 1000)} s`);
    }
    await sleep(1000);
  }
}

// --- processes ---------------------------------------------------------------

interface Child {
  name: string;
  proc: ReturnType<typeof Bun.spawn>;
  recent: string[];
  done: boolean;
}

const children: Child[] = [];
let stopping = false;

/** Starts `bun run <args>` in a package folder. Only the handle returned here is ever stopped: never a process by name. */
function launch(name: string, cwd: string, args: string[], env: Record<string, string>): Child {
  const proc = Bun.spawn(['bun', 'run', ...args], {
    cwd: join(repo, cwd),
    env: { ...process.env, ...env },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const child: Child = { name, proc, recent: [], done: false };
  children.push(child);
  const read = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      for (const line of decoder.decode(chunk).split('\n')) {
        if (!line.trim()) continue;
        child.recent.push(line);
        if (child.recent.length > 40) child.recent.shift();
        if (verbose) console.log(`[${name}] ${line}`);
      }
    }
  };
  void read(proc.stdout as ReadableStream<Uint8Array>);
  void read(proc.stderr as ReadableStream<Uint8Array>);
  void proc.exited.then((code) => {
    child.done = true;
    if (!stopping) void abort(`${name} stopped on its own (exit ${code}).`);
  });
  return child;
}

/** Stops what this script started, by handle, and deletes the temporary folder. */
async function stopAll(code: number): Promise<never> {
  if (stopping) return new Promise<never>(() => undefined);
  stopping = true;
  for (const child of children) if (!child.done) child.proc.kill();
  await Promise.race([Promise.allSettled(children.map((child) => child.proc.exited)), sleep(5000)]);
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    // A database file may still be closing; the OS temp folder is cleaned up later.
  }
  process.exit(code);
}

async function abort(message: string): Promise<never> {
  console.error(`ERROR: ${message}`);
  if (!verbose) {
    for (const child of children) {
      if (child.recent.length === 0) continue;
      console.error(`--- last lines of ${child.name} ---`);
      for (const line of child.recent.slice(-15)) console.error(`  ${line}`);
    }
  }
  return stopAll(1);
}

process.on('SIGINT', () => void stopAll(0));
process.on('SIGTERM', () => void stopAll(0));

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => resolve(true)));
  });
}

/**
 * The port named by `variable` when it is set (and must be free), else the first free one from `first` on. Ports the
 * developer's own servers use are never taken.
 */
async function pickPort(variable: string, first: number, taken: number[]): Promise<number> {
  const override = process.env[variable];
  const candidates = override
    ? [Number(override)]
    : Array.from({ length: 50 }, (_, index) => first + index);
  for (const port of candidates) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error(`${variable} must be a port number.`);
    }
    if (FORBIDDEN_PORTS.includes(port) || taken.includes(port)) {
      if (override) throw new Error(`${variable}=${port} is reserved for another server.`);
      continue;
    }
    if (await portFree(port)) return port;
    if (override) throw new Error(`${variable}=${port} is taken.`);
  }
  throw new Error(`No free port from ${first} for ${variable}.`);
}

async function waitFor(url: string, what: string, child: Child): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (child.done) await abort(`${what} stopped before it answered.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await sleep(500);
  }
  await abort(`${what} did not answer at ${url}.`);
}

// --- configuration -----------------------------------------------------------

const workDir = mkdtempSync(join(tmpdir(), 'keres-age-local-'));

interface Urls {
  /** Empty in `disabled` mode: there is no verification service to address. */
  verify: string;
  api: string;
}

/** The reviewer's login for this run; the password is random and only printed in the interactive mode. */
const REVIEWER_NAME = `reviewer-${suffix()}`;
const REVIEWER_PASSWORD = randomBytes(18).toString('base64url');
const ROOT_USERNAME = 'root';
const ROOT_PASSWORD = secret();

// --- the drive ----------------------------------------------------------------

interface Person {
  username: string;
  password: string;
  pending: string;
  verifyUrl: string;
  session?: string;
}

interface Reviewer {
  verify: string;
  cookie: string;
  csrf: string;
}

async function step(number: number, label: string, run: () => Promise<string>): Promise<void> {
  try {
    const detail = await run();
    console.log(`PASS ${number}. ${label}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${number}. ${label}: ${reason}`);
    throw error;
  }
}

/** Creates an account on the server and checks the answer that starts its verification. */
async function registerPerson(urls: Urls, label: string): Promise<Person> {
  const username = `drive-${label}-${suffix()}`;
  const password = `pw-${randomBytes(12).toString('base64url')}`;
  const answer = await send('POST', `${urls.api}/api/auth/register`, {
    json: { username, password },
  });
  expect(answer.status === 200, `register answered ${answer.status}`);
  expect(dig(answer.body, 'verification', 'status') === 'pending', 'the account is not pending');
  expect(dig(answer.body, 'verification', 'action', 'kind') === 'redirect', 'no redirect action');
  const url = new URL(String(dig(answer.body, 'verification', 'action', 'url')));
  expect(url.origin === urls.verify, `the upload link is at ${url.origin}, not the service`);
  expect(
    url.protocol === 'https:' || LOOPBACK_HOSTS.includes(url.hostname),
    'the upload link is neither https nor loopback',
  );
  const pending = dig(answer.body, 'accessToken');
  expect(typeof pending === 'string', 'the register answer has no token');
  return { username, password, pending, verifyUrl: url.toString().replace(/\/$/, '') };
}

/** The person's side: the upload page opens, then the document and the live photo are sent. */
async function upload(person: Person): Promise<void> {
  const page = await send('GET', person.verifyUrl);
  expect(
    page.status === 200 && page.text.includes('id="upload-form"'),
    `the page answered ${page.status}`,
  );
  const form = new FormData();
  form.append('front', new Blob([PNG], { type: 'image/png' }), 'front.png');
  form.append('photo', new Blob([PNG], { type: 'image/png' }), 'photo.png');
  const sent = await send('POST', `${person.verifyUrl}/upload`, {
    multipart: form,
    accept: 'application/json',
  });
  expect(
    sent.status === 200 && dig(sent.body, 'ok') === true,
    `the upload answered ${sent.status} (${String(dig(sent.body, 'code') ?? 'no code')})`,
  );
}

async function reviewerSession(verify: string): Promise<Reviewer> {
  const login = await send('POST', `${verify}/review/login`, {
    form: { name: REVIEWER_NAME, password: REVIEWER_PASSWORD },
  });
  const cookie = sessionCookieOf(login);
  expect(login.status === 303 && cookie !== undefined, `reviewer sign-in answered ${login.status}`);
  const queue = await send('GET', `${verify}/review`, { cookie });
  const csrf = /name="csrf" value="([^"]+)"/.exec(queue.text)?.[1];
  expect(queue.status === 200 && csrf !== undefined, `the queue answered ${queue.status}`);
  return { verify, cookie, csrf };
}

/** The id of the queue row that shows this username, read from the queue page (the claim form names it). */
function queueItemId(html: string, username: string): string | undefined {
  for (const row of html.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
    if (!row.includes(`<span>${username}</span>`)) continue;
    const id = /action="\/review\/items\/([0-9a-f-]{36})\/claim"/.exec(row);
    if (id) return id[1];
  }
  return undefined;
}

/** Claims the person's sending from the queue, then checks both images the claimer is shown are the ones sent. */
async function claimAndLook(reviewer: Reviewer, person: Person): Promise<string> {
  const queue = await send('GET', `${reviewer.verify}/review`, { cookie: reviewer.cookie });
  const id = queueItemId(queue.text, person.username);
  expect(id !== undefined, `${person.username} is not in the queue`);
  const claim = await send('POST', `${reviewer.verify}/review/items/${id}/claim`, {
    cookie: reviewer.cookie,
    form: { csrf: reviewer.csrf },
  });
  expect(claim.status === 303, `claim answered ${claim.status}`);
  for (const path of ['doc/1', 'photo']) {
    const image = await send('GET', `${reviewer.verify}/review/items/${id}/${path}`, {
      cookie: reviewer.cookie,
    });
    expect(image.status === 200, `the ${path} image answered ${image.status}`);
    expect(image.bytes.equals(PNG), `the ${path} image is not the one that was sent`);
  }
  return id as string;
}

async function approve(reviewer: Reviewer, id: string): Promise<void> {
  const decided = await send('POST', `${reviewer.verify}/review/items/${id}/approve`, {
    cookie: reviewer.cookie,
    form: { csrf: reviewer.csrf, ...IDENTITY, dateOfBirth: ADULT_BIRTH_DATE },
  });
  expect(
    decided.status === 303 && String(decided.headers.get('location')).includes('flash=approved'),
    `approval answered ${decided.status} ${decided.headers.get('location') ?? ''}`,
  );
}

async function refuse(reviewer: Reviewer, id: string, reason: string): Promise<void> {
  const decided = await send('POST', `${reviewer.verify}/review/items/${id}/reject`, {
    cookie: reviewer.cookie,
    form: { csrf: reviewer.csrf, reason },
  });
  expect(
    decided.status === 303 && String(decided.headers.get('location')).includes('flash=rejected'),
    `refusal answered ${decided.status}`,
  );
}

/** Polls the person's standing until it is no longer pending. */
async function standingOf(urls: Urls, person: Person, timeoutMs: number): Promise<Answer> {
  return poll(
    'the decision reaching Keres',
    async () => {
      const answer = await send('GET', `${urls.api}/api/auth/verification`, {
        token: person.pending,
      });
      return dig(answer.body, 'status') === 'pending' ? undefined : answer;
    },
    timeoutMs,
  );
}

async function runSteps(urls: Urls): Promise<void> {
  const { api } = urls;
  let first!: Person;
  let reviewer!: Reviewer;
  let approvedSession = '';

  await step(1, 'the server says verification is required and available', async () => {
    const info = await poll(
      'the service connecting to the server',
      async () => {
        const answer = await send('GET', `${api}/api/age-verification/info`);
        return dig(answer.body, 'available') === true ? answer : undefined;
      },
      30_000,
    );
    expect(dig(info.body, 'mode') === 'required', `mode is ${String(dig(info.body, 'mode'))}`);
    return 'mode required, available';
  });

  await step(2, 'registering starts a pending verification with an upload link', async () => {
    first = await registerPerson(urls, 'a');
    return 'status pending, redirect to the service';
  });

  await step(3, 'the pending account is refused everywhere but the verification', async () => {
    const plan = await send('GET', `${api}/api/user/plan`, { token: first.pending });
    expect(plan.status === 403, `the plan answered ${plan.status}`);
    expect(dig(plan.body, 'code') === 'verification_pending', 'the refusal has no pending code');
    const standing = await send('GET', `${api}/api/auth/verification`, { token: first.pending });
    expect(dig(standing.body, 'status') === 'pending', 'the standing is not pending');
    return 'plan 403 verification_pending; standing pending';
  });

  await step(4, 'the person uploads the document and the live photo', async () => {
    await upload(first);
    return 'front and photo accepted';
  });

  await step(5, 'the reviewer claims, sees both images and approves an adult', async () => {
    reviewer = await reviewerSession(urls.verify);
    const id = await claimAndLook(reviewer, first);
    await approve(reviewer, id);
    return 'approved with an adult date of birth';
  });

  await step(6, 'the approval reaches Keres and the account gets a fresh session', async () => {
    const answer = await poll(
      'the approval reaching Keres',
      async () => {
        const standing = await send('GET', `${api}/api/auth/verification`, {
          token: first.pending,
        });
        const status = dig(standing.body, 'status');
        if (status === 'rejected' || status === 'expired') {
          throw new Error(`the account was ${String(status)} instead`);
        }
        return status === 'approved' ? standing : undefined;
      },
      30_000,
    );
    const session = dig(answer.body, 'session', 'accessToken');
    expect(typeof session === 'string', 'approved, but no fresh session was given');
    approvedSession = session;
    first.session = session;
    return 'status approved, session issued';
  });

  await step(7, 'the new session reaches the app; the pending token still does not', async () => {
    const fresh = await send('GET', `${api}/api/user/plan`, { token: approvedSession });
    expect(fresh.status === 200, `the plan with the new session answered ${fresh.status}`);
    const old = await send('GET', `${api}/api/user/plan`, { token: first.pending });
    expect(old.status === 403, `the plan with the old token answered ${old.status}`);
    return 'new session 200; old token 403';
  });

  await step(8, 'a second account with the same document is refused and not verified', async () => {
    const second = await registerPerson(urls, 'b');
    await upload(second);
    const id = await claimAndLook(reviewer, second);
    await approve(reviewer, id);
    const standing = await standingOf(urls, second, 30_000);
    expect(
      dig(standing.body, 'status') === 'rejected',
      `the account is ${String(dig(standing.body, 'status'))}`,
    );
    expect(dig(standing.body, 'reason') === 'document_reused', 'the reason is not document_reused');
    expect(
      dig(standing.body, 'session') === undefined,
      'a session was given to the second account',
    );
    const plan = await send('GET', `${api}/api/user/plan`, { token: second.pending });
    expect(plan.status === 403, `the plan answered ${plan.status} for the second account`);
    return 'rejected: document_reused; not verified';
  });

  await step(9, 'an underage refusal closes the account: no retry, no sign-in', async () => {
    const third = await registerPerson(urls, 'c');
    await upload(third);
    const id = await claimAndLook(reviewer, third);
    await refuse(reviewer, id, 'underage');
    const standing = await standingOf(urls, third, 30_000);
    expect(
      dig(standing.body, 'status') === 'rejected',
      `the account is ${String(dig(standing.body, 'status'))}`,
    );
    expect(dig(standing.body, 'reason') === 'underage', 'the reason is not underage');
    expect(dig(standing.body, 'canRetry') !== true, 'a retry is offered after underage');
    const retry = await send('POST', `${api}/api/auth/verification/retry`, {
      token: third.pending,
    });
    expect(retry.status >= 400, `the retry answered ${retry.status}`);
    const login = await send('POST', `${api}/api/auth/login`, {
      json: { username: third.username, password: third.password },
    });
    expect(login.status !== 200, `sign-in answered ${login.status}`);
    return 'rejected: underage; no retry; sign-in refused';
  });
}

/**
 * The drive of a `disabled` server: there is no service, so the steps check that the server says so and acts on it.
 * A new account gets its session at once (no pending claim), the terms say there is no age verification, and nobody
 * can be marked verified or switch the adults-only area on.
 */
async function runDisabledSteps(api: string): Promise<void> {
  let token = '';
  let userId = '';
  let adminToken = '';

  await step(1, 'the server says verification is disabled and not available', async () => {
    const info = await send('GET', `${api}/api/age-verification/info`);
    expect(info.status === 200, `the info answered ${info.status}`);
    expect(dig(info.body, 'mode') === 'disabled', `mode is ${String(dig(info.body, 'mode'))}`);
    expect(dig(info.body, 'available') === false, 'the server says verification is available');
    return 'mode disabled, not available';
  });

  await step(2, 'registering gives a session at once, with no pending token', async () => {
    const answer = await send('POST', `${api}/api/auth/register`, {
      json: {
        username: `drive-off-${suffix()}`,
        password: `pw-${randomBytes(12).toString('base64url')}`,
      },
    });
    expect(answer.status === 200, `register answered ${answer.status}`);
    expect(
      dig(answer.body, 'verification') === undefined,
      'the register answer has a verification',
    );
    const access = dig(answer.body, 'accessToken');
    expect(typeof access === 'string', 'the register answer has no session');
    // The claim the request pipeline refuses; a session of an unverified account would carry it.
    const claims: unknown = JSON.parse(
      Buffer.from(access.split('.')[1] ?? '', 'base64url').toString('utf8'),
    );
    expect(dig(claims, 'pending') !== true, 'the session is pending');
    token = access;
    userId = String(dig(answer.body, 'userId'));
    return 'session at once, no verification';
  });

  await step(3, 'the new account is usable at once: its plan answers 200', async () => {
    const plan = await send('GET', `${api}/api/user/plan`, { token });
    expect(plan.status === 200, `the plan answered ${plan.status}`);
    return 'plan 200';
  });

  await step(4, "the server's terms say there is no age verification", async () => {
    const terms = await send('GET', `${api}/api/keres-tos`);
    expect(terms.status === 200, `the terms answered ${terms.status}`);
    expect(terms.text.includes('No age verification on this server'), 'the terms do not say so');
    return 'terms say no age verification';
  });

  await step(5, 'the root administrator signs in', async () => {
    const login = await send('POST', `${api}/api/auth/login`, {
      json: { username: ROOT_USERNAME, password: ROOT_PASSWORD, session: 'token' },
    });
    expect(login.status === 200, `sign-in answered ${login.status}`);
    const access = dig(login.body, 'accessToken');
    expect(typeof access === 'string', 'the administrator got no session');
    adminToken = access;
    return '';
  });

  // The admin routes take PUT (there is no PATCH); both refusals come before any write.
  await step(6, 'an administrator cannot mark an account verified', async () => {
    const answer = await send('PUT', `${api}/api/admin/users/${userId}`, {
      token: adminToken,
      json: { isAdultVerified: true },
    });
    expect(answer.status === 400, `the change answered ${answer.status}`);
    return 'refused 400';
  });

  await step(7, 'the adults-only area cannot be switched on', async () => {
    const answer = await send('PUT', `${api}/api/admin/registration-settings`, {
      token: adminToken,
      json: { allowNsfw: true },
    });
    expect(answer.status === 400, `the change answered ${answer.status}`);
    return 'refused 400';
  });
}

// --- start-up -----------------------------------------------------------------

async function createReviewer(env: Record<string, string>): Promise<void> {
  const proc = Bun.spawn(['bun', 'run', 'src/cli/addReviewer.ts', REVIEWER_NAME], {
    cwd: join(repo, 'apps/verification'),
    env: { ...process.env, ...env, REVIEWER_PASSWORD },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout as ReadableStream).text(),
    new Response(proc.stderr as ReadableStream).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0)
    await abort(`the reviewer could not be created (exit ${code}): ${(err || out).trim()}`);
}

async function main(): Promise<void> {
  // The service takes a port only in `required` mode; the API takes the first free one from 3301 in both modes.
  const verifyPort = disabled ? undefined : await pickPort('LOCAL_VERIFY_PORT', 3102, []);
  const apiPort = await pickPort(
    'LOCAL_API_PORT',
    3301,
    verifyPort === undefined ? [] : [verifyPort],
  );
  const urls: Urls = {
    verify: verifyPort === undefined ? '' : `http://127.0.0.1:${verifyPort}`,
    api: `http://127.0.0.1:${apiPort}`,
  };
  const keresSecret = secret();
  const eventsSecret = secret();
  const commitmentKey = secret();

  // What the service reads. The same block is used for its CLI, so the reviewer lands in the database it reads.
  // Only in `required` mode: a `disabled` server has no service to start and no reviewer to create.
  let verifierEnv: Record<string, string> = {};
  if (!disabled)
    verifierEnv = {
      HOST: '127.0.0.1',
      PORT: String(verifyPort),
      SERVICE_ID: 'keres-local',
      DISPLAY_NAME: 'Keres local verification',
      PUBLIC_URL: urls.verify,
      KERES_EVENTS_URL: `${urls.api}/api/age-verification/events`,
      AGE_VERIFICATION_SECRET: keresSecret,
      AGE_VERIFICATION_SECRET_PREVIOUS: '',
      AGE_VERIFICATION_EVENTS_SECRET: eventsSecret,
      COMMITMENT_KEY: commitmentKey,
      DATA_DIR: join(workDir, 'verification-data'),
      KEY_DIR: join(workDir, 'verification-keys'),
      ALLOW_INSECURE: 'false',
    };
  // The age-verification keys of the server. In `disabled` mode they are empty, not absent: an empty value wins over
  // the developer's apps/api/.env, so a service configured there cannot switch on in this run.
  const ageVerificationEnv: Record<string, string> = disabled
    ? {
        AGE_VERIFICATION_MODE: 'disabled',
        AGE_VERIFICATION_URL: '',
        AGE_VERIFICATION_SECRET: '',
        AGE_VERIFICATION_SECRET_PREVIOUS: '',
        AGE_VERIFICATION_EVENTS_SECRET: '',
        AGE_VERIFICATION_EVENTS_SECRET_PREVIOUS: '',
        AGE_VERIFICATION_ALLOW_INSECURE: '',
        AGE_VERIFICATION_PENDING_DAYS: '',
        AGE_VERIFICATION_MAX_ATTEMPTS: '',
      }
    : {
        AGE_VERIFICATION_MODE: 'required',
        AGE_VERIFICATION_URL: urls.verify,
        AGE_VERIFICATION_SECRET: keresSecret,
        AGE_VERIFICATION_SECRET_PREVIOUS: '',
        AGE_VERIFICATION_EVENTS_SECRET: eventsSecret,
        AGE_VERIFICATION_EVENTS_SECRET_PREVIOUS: '',
        AGE_VERIFICATION_ALLOW_INSECURE: 'false',
        AGE_VERIFICATION_PENDING_DAYS: '',
        AGE_VERIFICATION_MAX_ATTEMPTS: '',
      };
  // What the server reads. Empty values win over the developer's apps/api/.env (the server only fills what is unset).
  const apiEnv: Record<string, string> = {
    // Without HOST the server listens on every interface, with a throwaway administrator password.
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: `file:${join(workDir, 'keres.db').replace(/\\/g, '/')}`,
    MEDIA_STORAGE_DRIVER: 'local',
    MEDIA_STORAGE_PATH: join(workDir, 'media'),
    JWT_SECRET: secret(),
    JWT_SECRET_REFRESH: secret(),
    ROOT_ADMIN_USERNAME: ROOT_USERNAME,
    ROOT_ADMIN_PASSWORD: ROOT_PASSWORD,
    ...ageVerificationEnv,
    PAYMENT_CONNECTOR_URL: '',
    PAYMENT_CONNECTOR_SECRET: '',
    PAYMENT_EVENTS_SECRET: '',
    PAYMENT_PLAY_ENDPOINT_SECRET: '',
  };

  if (!disabled) {
    const verifier = launch('verify', 'apps/verification', ['src/index.ts'], verifierEnv);
    await waitFor(`${urls.verify}/health`, 'The verification service', verifier);
  }
  const api = launch('api', 'apps/api', ['src/server.ts'], apiEnv);
  await waitFor(`${urls.api}/api/public/tiers`, 'The Keres API', api);
  if (!disabled) await createReviewer(verifierEnv);

  if (drive) {
    if (disabled) await runDisabledSteps(urls.api);
    else await runSteps(urls);
    console.log('All steps passed.');
    await stopAll(0);
  }

  if (disabled) {
    console.log(`
Keres API (verification disabled)
  Keres API             ${urls.api}      (register: POST ${urls.api}/api/auth/register)
  Hosted client         ${urls.api}/client/
  Admin panel           ${urls.api}/admin   (${ROOT_USERNAME} / ${ROOT_PASSWORD})
disabled: accounts are active at once, no adults-only area
To register in the app: Manage Servers -> + -> Create Account, with the address ${urls.api}
Ctrl+C stops it and deletes the temporary folder.`);
  } else {
    console.log(`
Both are up.
  Verification service  ${urls.verify}      (reviewers: ${urls.verify}/review/login)
  Keres API             ${urls.api}      (register: POST ${urls.api}/api/auth/register)
  Hosted client         ${urls.api}/client/
  Reviewer              ${REVIEWER_NAME} / ${REVIEWER_PASSWORD}
  Admin panel           ${urls.api}/admin   (${ROOT_USERNAME} / ${ROOT_PASSWORD})
A registered account waits, pending: its upload link is verification.action.url in the register answer.
To register in the app: Manage Servers -> + -> Create Account, with the address ${urls.api}
Ctrl+C stops both and deletes the temporary folder.`);
  }
  await new Promise(() => undefined);
}

main().catch((error: unknown) => {
  void abort(error instanceof Error ? error.message : String(error));
});
