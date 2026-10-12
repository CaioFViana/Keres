import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { env } from '../../config/env';
import { jwtRefresh } from '../../config/jwt';
import { createPersistentAttemptLimiter } from '../../services/AttemptLimitService';
import { userService } from '../../services/UserService';
import {
  AgeVerificationUserNotFoundError,
  ageVerificationService,
  VerificationRetryNotAllowedError,
  VerificationUnavailableError,
} from '../../services/ageVerification/AgeVerificationService';
import { verificationUnavailable } from '../../services/ageVerification/accountRegistration';
import { AppError } from '../../utils/errors';
import type { JWTPayload } from '../../index';
import { languageOf } from '../payments/payment.route';
import {
  AccountVerificationStatusResponseSchema,
  CodedMessageResponseSchema,
  MessageResponseSchema,
} from './authSchemas';
import { setSessionCookies } from './authSession';

/**
 * A person asking for a new sending after a refusal: a few an hour per account, so a stuck person does not hammer the
 * verification service (the attempt limit of the verification itself is `AGE_VERIFICATION_MAX_ATTEMPTS`).
 */
const verificationRetryLimiter = createPersistentAttemptLimiter('age-verification-retry', {
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});

/** `GET /auth/verification`: the standing, plus the fresh session once the account has become active. */
const AccountVerificationResponseSchema = t.Composite([
  AccountVerificationStatusResponseSchema,
  t.Object({
    session: t.Optional(t.Object({ accessToken: t.String(), refreshToken: t.String() })),
  }),
]);

/** The same decorators as authRoutes: TypeScript only sees what the chain declares, and the handlers below read jwt, jwtRefresh, cookie and user. */
export const authVerificationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: '1h', // Access token expiration, consistent with index.ts
      schema: t.Object({
        userId: t.String(),
        username: t.String(),
      }),
    }),
  )
  .use(jwtRefresh)
  .get(
    '/verification',
    async ({ user, jwt, jwtRefresh, cookie }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      const standing = await userService.verificationStanding(user.userId);
      if (!standing) {
        throw new AppError(401, 'Unauthorized');
      }
      const status = await ageVerificationService.statusFor(user.userId);
      // The session presented is pending and the account has since become active: the person is let in now. The
      // fresh session is given once, here - the next answer comes to a session that has no claim, so it has none.
      if (user.pending && standing.verificationStatus === 'active' && !standing.isDeleted) {
        const accessToken = await jwt.sign({ userId: user.userId, username: user.username });
        const refreshToken = await jwtRefresh.sign({
          userId: user.userId,
          username: user.username,
        });
        setSessionCookies(cookie, accessToken, refreshToken);
        return { ...status, session: { accessToken, refreshToken } };
      }
      return status;
    },
    {
      response: {
        200: AccountVerificationResponseSchema,
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Standing of the account in age verification',
        description:
          'Where this account stands (`pending` with what to do, `approved`, `rejected` or `expired` with whether it can send again, `not_required`). A pending session can call it. Once the account is active, a pending session gets a fresh full `session` in this answer, once.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/verification/retry',
    async ({ user, request }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (!(await verificationRetryLimiter.registerAttempt(user.userId))) {
        throw new AppError(429, 'Too many attempts. Try again later.');
      }
      try {
        const started = await ageVerificationService.retry(
          user.userId,
          languageOf(request.headers.get('accept-language')),
        );
        return started.status;
      } catch (error) {
        if (error instanceof VerificationRetryNotAllowedError) {
          throw new AppError(409, error.message);
        }
        if (error instanceof VerificationUnavailableError) {
          throw verificationUnavailable();
        }
        if (error instanceof AgeVerificationUserNotFoundError) {
          throw new AppError(401, 'Unauthorized');
        }
        throw error;
      }
    },
    {
      response: {
        200: AccountVerificationStatusResponseSchema,
        401: MessageResponseSchema,
        409: MessageResponseSchema,
        429: MessageResponseSchema,
        503: CodedMessageResponseSchema,
      },
      detail: {
        summary: 'Send the document again after a refusal or an expiry',
        description:
          'A new sending, another reviewer than the one who refused it. Allowed while the last sending was refused or expired, within the attempt limit; an underage refusal closes the account instead.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
