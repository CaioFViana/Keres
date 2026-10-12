import {
  type Direction,
  signRequestHeaders,
} from '../../src/services/ageVerification/connector/signing';
import { getApp } from './app';

/** The keys the server checks a service's events with, and signs its own requests with: one per direction. */
export const AGE_EVENTS_SECRET = process.env.AGE_VERIFICATION_EVENTS_SECRET as string;

export const AGE_EVENTS_PATH = '/api/age-verification/events';

export interface SignVerifierEventsOptions {
  /** Signs with a key the server does not know. */
  forged?: boolean;
  secret?: string;
  /** What is sent, when it is not the JSON of `{ events }`. */
  rawBody?: string;
  /** What is signed, when it is not what is sent: a body changed on the way. */
  signedBody?: string;
  direction?: Direction;
  /** Headers of the signature to change or drop (`undefined` drops it). */
  headers?: Record<string, string | undefined>;
  /** The time the message says it was made, in milliseconds. */
  at?: number;
}

export interface SignedVerifierEvents {
  body: string;
  headers: Record<string, string>;
  nonce: string;
}

/** The request an age-verification service would make to deliver these events: the JSON `{ events }`, signed. */
export function signVerifierEvents(
  events: Record<string, unknown>[],
  options: SignVerifierEventsOptions = {},
): SignedVerifierEvents {
  const body = options.rawBody ?? JSON.stringify({ events });
  const secret = options.forged ? 'x'.repeat(40) : (options.secret ?? AGE_EVENTS_SECRET);
  const signed = signRequestHeaders(
    secret,
    {
      direction: options.direction ?? 'verifier-to-keres',
      method: 'POST',
      path: AGE_EVENTS_PATH,
      body: options.signedBody ?? body,
    },
    options.at,
  );
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  for (const [name, value] of Object.entries({ ...signed, ...options.headers })) {
    if (value !== undefined) headers[name] = value;
  }
  return { body, headers, nonce: signed['x-keres-nonce'] };
}

/** Sends a request to the events route as it is - the same one twice is a replay. */
export async function sendVerifierEvents(request: Pick<SignedVerifierEvents, 'body' | 'headers'>) {
  const app = await getApp();
  const response = await app.handle(
    new Request(`http://localhost${AGE_EVENTS_PATH}`, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    }),
  );
  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  return { status: response.status, data, headers: response.headers, text };
}

/** Delivers events to the server the way a service does, and returns what the server answered. */
export async function postVerifierEvents(
  events: Record<string, unknown>[],
  options: SignVerifierEventsOptions = {},
) {
  const request = signVerifierEvents(events, options);
  return { ...(await sendVerifierEvents(request)), nonce: request.nonce };
}
