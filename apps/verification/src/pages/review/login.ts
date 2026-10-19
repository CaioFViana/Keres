import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../crypto/password';
import { sha256Hex } from '../../protocol/signing';
import type { ServiceState } from '../../routes';
import {
  bareResponse,
  clientAddress,
  htmlResponse,
  newNonce,
  seeOther,
  sameOriginOrAbsent,
} from '../http';
import { pageLanguage } from '../language';
import type { Lang } from '../http';
import { readForm, textField } from './form';
import { loginHtml } from './reviewView';
import { newSessionToken, REVIEW_PATH, SESSION_LIFETIME_MS, sessionCookie } from './session';

/**
 * Reviewer sign-in. The same answer for an unknown name and for a wrong password, and the same work for both (a scrypt
 * against a dummy hash when the name is unknown), so neither the text nor the time tells which names exist.
 *
 * Failures are counted per name and address: five in fifteen minutes lock that pair out for fifteen minutes. The count
 * covers any name, known or not, so the lock says nothing about the accounts. In memory: a restart clears it.
 */

export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
const MAX_NAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_TRACKED = 10_000;

interface Track {
  failures: number[];
  lockedUntil: number;
}

export class LoginGuard {
  private readonly tracks = new Map<string, Track>();

  locked(key: string, now: number): boolean {
    const track = this.tracks.get(key);
    return track !== undefined && track.lockedUntil > now;
  }

  /** Counts a failure; true when this one locked the pair. */
  failed(key: string, now: number): boolean {
    if (!this.tracks.has(key) && this.tracks.size >= MAX_TRACKED) this.forget(now);
    const track = this.tracks.get(key) ?? { failures: [], lockedUntil: 0 };
    track.failures = track.failures.filter((at) => now - at < FAILURE_WINDOW_MS);
    track.failures.push(now);
    if (track.failures.length >= MAX_FAILURES) {
      track.lockedUntil = now + LOCK_MS;
      track.failures = [];
    }
    this.tracks.set(key, track);
    return track.lockedUntil > now;
  }

  succeeded(key: string): void {
    this.tracks.delete(key);
  }

  /** Drops the tracks that are neither locked nor holding a failure; if none, the oldest. */
  private forget(now: number): void {
    for (const [key, track] of this.tracks) {
      if (track.lockedUntil <= now && track.failures.every((at) => now - at >= FAILURE_WINDOW_MS)) {
        this.tracks.delete(key);
      }
    }
    if (this.tracks.size >= MAX_TRACKED) {
      const oldest = this.tracks.keys().next().value;
      if (oldest !== undefined) this.tracks.delete(oldest);
    }
  }
}

const guards = new WeakMap<ServiceState, LoginGuard>();

export function guardOf(state: ServiceState): LoginGuard {
  let guard = guards.get(state);
  if (!guard) {
    guard = new LoginGuard();
    guards.set(state, guard);
  }
  return guard;
}

/** A scrypt hash nobody knows the password of: checked when the name is unknown, to spend the same time. */
let unknownHash: Promise<string> | undefined;
const dummyHash = (): Promise<string> => {
  unknownHash ??= hashPassword(randomBytes(24).toString('base64url'));
  return unknownHash;
};

const languageOf = (request: Request): Lang =>
  pageLanguage(undefined, request.headers.get('accept-language'));

export function loginPage(request: Request, flash: string | null): Response {
  const nonce = newNonce();
  return htmlResponse(200, loginHtml({ lang: languageOf(request), nonce, flash }), nonce);
}

export async function loginSubmit(request: Request, state: ServiceState): Promise<Response> {
  const nonce = newNonce();
  const lang = languageOf(request);
  if (!sameOriginOrAbsent(request, state.config.publicUrl)) return bareResponse(403);
  const form = await readForm(request);
  if (!form) return htmlResponse(400, loginHtml({ lang, nonce, error: 'badForm' }), nonce);

  const now = state.clock();
  const name = textField(form, 'name', true);
  const password = textField(form, 'password');
  const key = `${name.toLowerCase()}\n${clientAddress(request)}`;
  const guard = guardOf(state);
  if (guard.locked(key, now)) {
    return htmlResponse(429, loginHtml({ lang, nonce, error: 'locked' }), nonce);
  }

  const reviewer =
    name.length > 0 && name.length <= MAX_NAME_LENGTH
      ? state.stores.reviewers.byName(name)
      : undefined;
  const matches =
    password.length > 0 &&
    password.length <= MAX_PASSWORD_LENGTH &&
    (await verifyPassword(password, reviewer?.passwordHash ?? (await dummyHash())));
  if (!reviewer || !matches) {
    const lockedNow = guard.failed(key, now);
    return htmlResponse(
      lockedNow ? 429 : 401,
      loginHtml({ lang, nonce, error: lockedNow ? 'locked' : 'invalid' }),
      nonce,
    );
  }

  guard.succeeded(key);
  const token = newSessionToken();
  state.stores.sessions.create(sha256Hex(token), reviewer.id, now, now + SESSION_LIFETIME_MS);
  return seeOther(REVIEW_PATH, [
    sessionCookie(state, token, Math.floor(SESSION_LIFETIME_MS / 1000)),
  ]);
}
