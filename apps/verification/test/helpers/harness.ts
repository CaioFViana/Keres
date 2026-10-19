import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, type VerificationConfig } from '../../src/config';
import {
  canonicalRequest,
  canonicalResponse,
  sha256Hex,
  sign,
  signatureMatches,
} from '../../src/protocol/signing';
import { createApp, createState, type PageRoute, type ServiceState } from '../../src/routes';

/** Obvious fakes, each at least 32 characters, all different. */
export const KERES_SECRET = 'test-keres-to-verifier-secret-0123456789';
export const PREVIOUS_KERES_SECRET = 'test-previous-keres-secret-0123456789';
export const EVENTS_SECRET = 'test-verifier-to-keres-events-secret-01';
export const COMMITMENT_KEY = 'test-commitment-key-0123456789abcdef-0';
export const KERES_EVENTS_URL = 'http://127.0.0.1:3000/api/age-verification/events';
export const PUBLIC_URL = 'https://verify.test';
export const ORIGIN = 'http://127.0.0.1:3102';

/** A fixed "now": 12 October 2026, 12:00 UTC. */
export const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);

export function testEnv(dataDir: string, keyDir: string): NodeJS.ProcessEnv {
  return {
    AGE_VERIFICATION_SECRET: KERES_SECRET,
    AGE_VERIFICATION_EVENTS_SECRET: EVENTS_SECRET,
    COMMITMENT_KEY,
    KERES_EVENTS_URL,
    PUBLIC_URL,
    DATA_DIR: dataDir,
    KEY_DIR: keyDir,
  } as NodeJS.ProcessEnv;
}

export interface Harness {
  root: string;
  config: VerificationConfig;
  state: ServiceState;
  app: ReturnType<typeof createApp>;
  /** Moves the fixed clock (milliseconds since the epoch). */
  setNow(ms: number): void;
  now(): number;
  close(): void;
}

/** A service on temporary directories with a clock the test moves. */
export function harness(
  options: { pages?: readonly PageRoute[]; env?: Partial<NodeJS.ProcessEnv> } = {},
): Harness {
  const root = mkdtempSync(join(tmpdir(), 'keres-verification-'));
  const dataDir = join(root, 'data');
  const keyDir = join(root, 'keys');
  const config = loadConfig({ ...testEnv(dataDir, keyDir), ...options.env });
  let current = T0;
  const state = createState(config, {
    clock: () => current,
    ...(options.pages ? { pages: options.pages } : {}),
  });
  return {
    root,
    config,
    state,
    app: createApp(state),
    setNow(ms: number) {
      current = ms;
    },
    now: () => current,
    close() {
      state.stores.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Every file under a directory, recursively. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Whether any file under `dir` holds `needle` as bytes (a text or a raw key). */
export function bytesContain(dir: string, needle: string | Uint8Array): boolean {
  const pattern = typeof needle === 'string' ? Buffer.from(needle, 'utf8') : Buffer.from(needle);
  return filesUnder(dir).some((file) => readFileSync(file).includes(pattern));
}

export interface SignedAnswer {
  status: number;
  text: string;
  json: unknown;
  headers: Headers;
  nonce: string;
}

let counter = 0;

/** Sends a call signed the way Keres signs it. Each call gets a fresh nonce unless one is given. */
export async function signedCall(
  h: Harness,
  method: string,
  path: string,
  options: {
    body?: unknown;
    rawBody?: string;
    secret?: string;
    timestamp?: number;
    nonce?: string;
    /** `payments`: sign the canonical string of the payments scheme (`KERES-CONNECT-V1`) instead. */
    scheme?: 'payments';
  } = {},
): Promise<SignedAnswer> {
  const text = options.rawBody ?? (options.body === undefined ? '' : JSON.stringify(options.body));
  const timestamp = options.timestamp ?? Math.floor(h.now() / 1000);
  counter += 1;
  const nonce = options.nonce ?? `test-nonce-${counter}-abcdefgh`;
  const secret = options.secret ?? KERES_SECRET;
  const headers: Record<string, string> = {
    'x-keres-timestamp': String(timestamp),
    'x-keres-nonce': nonce,
    'x-keres-signature': sign(
      secret,
      canonicalRequest({ method, path, timestamp, nonce, body: text }),
    ),
  };
  if (options.scheme === 'payments') {
    // The canonical string of the payments service, same key: the age service must refuse it.
    headers['x-keres-signature'] = sign(
      secret,
      [
        'KERES-CONNECT-V1',
        'keres-to-connector',
        method,
        path,
        String(timestamp),
        nonce,
        sha256Hex(text),
      ].join('\n'),
    );
  }
  if (text) headers['content-type'] = 'application/json';
  const response = await h.app.fetch(
    new Request(`${ORIGIN}${path}`, { method, headers, body: text || undefined }),
  );
  const body = await response.text();
  return {
    status: response.status,
    text: body,
    json: body ? (JSON.parse(body) as unknown) : undefined,
    headers: response.headers,
    nonce,
  };
}

/** Whether an answer carries a valid signature from the Keres key that answered it. */
export function answerIsSigned(answer: SignedAnswer, secret: string = KERES_SECRET): boolean {
  const timestamp = Number(answer.headers.get('x-keres-timestamp'));
  return signatureMatches(
    [secret],
    canonicalResponse({
      requestNonce: answer.nonce,
      status: answer.status,
      timestamp,
      body: answer.text,
    }),
    answer.headers.get('x-keres-signature') ?? undefined,
  );
}
