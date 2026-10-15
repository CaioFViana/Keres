import { AgeVerificationInfoSchema, VerificationEventsRequestSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { ageVerificationService } from '@/services/ageVerification/AgeVerificationService';
import { getAgeVerifier } from '@/services/ageVerification/AgeVerifierRegistry';
import {
  ageVerificationMode,
  isAgeVerificationRequired,
} from '@/services/ageVerification/ageVerificationMode';
import { verifierEventsSecrets } from '@/services/ageVerification/connector/config';
import {
  HEADER_NONCE,
  NonceCache,
  signResponseHeaders,
  verifyRequest,
} from '@/services/ageVerification/connector/signing';
import { toVerificationEvent } from '@/services/ageVerification/verificationEvents';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

/** What a service's request may weigh: a batch of events is a few kilobytes. */
const EVENTS_MAX_BYTES = 256 * 1024;

/** The path the service signs, as the contract names it: not the address after a proxy has rewritten it. */
const EVENTS_PATH = '/api/age-verification/events';

const eventNonces = new NonceCache();

/**
 * What the verification service reports, mounted at `/api/age-verification/events`. Public in the sense that no user is
 * signed in - it is a service calling - and protected by what proves it is the service: a signature over the method,
 * the path, a timestamp, a one-time nonce and the body (see `connector/signing.ts`), with the events key and the
 * `KERES-AGE-V1` scheme. An unproven request is refused before a byte of it is read as anything.
 *
 * It answers 200 with the outcome of each event (an event about a sending this server never made is `unknown` and
 * ignored), 401 when the request is not proven, 400 when it is proven but is not what the contract says, and 404 while
 * no service is connected to receive it - the service keeps its events and sends them again. Applying an event is
 * idempotent, so a retry is always safe. The answer is signed with the events key, so the service can tell it is Keres.
 */
export const ageVerificationEventsRoutes = new Elysia().post(
  '/events',
  async ({ body, request }) => {
    const verifier = getAgeVerifier();
    const secrets = verifierEventsSecrets();
    if (!verifier || secrets.length === 0) {
      throw new AppError(404, 'Age verification is not enabled on this server.');
    }
    if (body.length > EVENTS_MAX_BYTES) throw new AppError(413, 'Request too large.');

    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    const verdict = verifyRequest({
      direction: 'verifier-to-keres',
      method: 'POST',
      path: EVENTS_PATH,
      headers,
      body,
      secrets,
      nonces: eventNonces,
    });
    if (!verdict.ok) {
      logger.warn(`An age-verification event request was refused (${verdict.reason}).`);
      // The same words whatever was wrong: a caller who is not the service learns nothing from them.
      throw new AppError(401, 'Request rejected.');
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AppError(400, 'The body is not JSON.');
    }
    const parsed = VerificationEventsRequestSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(
        400,
        `Invalid events (${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}).`,
      );
    }

    const events = parsed.data.events.map(toVerificationEvent);
    const outcomes = await ageVerificationService.applyEvents(verifier.id, events);
    const answer = JSON.stringify({
      received: events.length,
      outcomes: events.map((event, index) => ({
        eventId: event.eventId,
        outcome: outcomes[index],
      })),
    });
    return new Response(answer, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...signResponseHeaders(secrets[0], {
          requestNonce: headers[HEADER_NONCE],
          status: 200,
          body: answer,
        }),
      },
    });
  },
  {
    // The raw text, whatever the content type says: the signature is over those bytes.
    parse: 'text',
    body: t.String(),
    detail: {
      summary: "The age-verification service's events (verified by their signature)",
      tags: ['Age verification'],
    },
  },
);

/**
 * Whether this server verifies age and whether it can do so now, mounted at `/api/age-verification`. Public: the app
 * asks it before a person starts an account. `available` is false in `disabled` mode whatever is connected.
 */
export const ageVerificationPublicRoutes = new Elysia().get(
  '/info',
  () => ({
    mode: ageVerificationMode(),
    available: isAgeVerificationRequired() && getAgeVerifier() !== null,
  }),
  {
    response: { 200: AgeVerificationInfoSchema },
    detail: {
      summary: 'Whether this server verifies age, and whether verification is available now',
      tags: ['Age verification'],
    },
  },
);
