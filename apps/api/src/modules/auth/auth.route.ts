import { jwt } from '@elysiajs/jwt';
import { ForgotPasswordSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { comparePassword, hashPassword } from '@/config/bcrypt';
import { env } from '@/config/env';
import { jwtRefresh } from '@/config/jwt';
import {
  InvalidRecoveryCodeError,
  RecoveryAttemptsLockedError,
  recoveryCodeService,
} from '@/services/auth/RecoveryCodeService';
import { createPersistentAttemptLimiter } from '@/services/auth/AttemptLimitService';
import { effectiveDefaultTierId } from '@/services/tiers/defaultTier';
import { registrationSettingsService } from '@/services/admin/RegistrationSettingsService';
import { termsAcceptanceService } from '@/services/auth/TermsAcceptanceService';
import { userService } from '@/services/accounts/UserService';
import { ageVerificationService } from '@/services/age-verification/AgeVerificationService';
import {
  createRegisteredAccount,
  requestSendingFor,
} from '@/services/age-verification/accountRegistration';
import { isAgeVerificationRequired } from '@/services/age-verification/ageVerificationMode';
import { AppError } from '@/utils/errors';
import { requestAddress } from '@/plugins/requestAudit';
import { accessRecordService } from '@/services/compliance/AccessRecordService';
import type { JWTPayload } from '@/index';
import { languageOf } from '@/modules/payments/payment.route';
import { createWebSocketTicket } from '@/modules/web-socket/webSocket.route';
import {
  AccountVerificationStatusResponseSchema,
  CodedMessageResponseSchema,
  MessageResponseSchema,
} from './authSchemas';
import { setSessionCookies } from './authSession';
import { authVerificationRoutes } from './authVerification.route';

/** Same window as /forgot-password's limiter (RecoveryCodeService); both keep their counters in the database. */
const loginAttemptLimiter = createPersistentAttemptLimiter('login', {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});

/**
 * Registrations one client address may attempt an hour, in both modes. In `required` mode each one is a sending at the
 * verification service and a pending account for the reviewers, so a script must not be able to fill that queue. Every
 * attempt counts, successes included: the helper's atomic step counts calls, and a count of accounts made alone would be
 * a read then a write that a burst gets past.
 */
const registrationLimiter = createPersistentAttemptLimiter('register', {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
});

/**
 * The claim a session carries while its account is not active in age verification: the request pipeline refuses it
 * everywhere except the verification routes (see `services/age-verification/pendingAccess.ts`). An active account's
 * session has no claim at all.
 */
const pendingClaim = (pending: boolean) => (pending ? { pending: true as const } : {});

/** What the account accepted against what applies now - the client re-presents whatever lags. */
const TermsStatusResponseSchema = t.Object({
  tos: t.Object({ accepted: t.Union([t.Number(), t.Null()]), current: t.Number() }),
  privacy: t.Object({ accepted: t.Union([t.Number(), t.Null()]), current: t.Number() }),
});

/** Success shape shared by /login and /forgot-password - both log the user in the same way. */
const AuthSessionResponseSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  userId: t.String(),
  username: t.String(),
  tag: t.String(),
});

export const authRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Registering the `jwt` plugin here again (same name/secret/schema as index.ts's copy) looks
  // redundant at first - Elysia dedupes same-named plugins at runtime, so only one decorator
  // actually exists once this is mounted under the parent app. It's kept anyway: `authRoutes`
  // is its own exported unit, and TypeScript only sees what THIS chain declares - the `jwt`
  // context property these handlers destructure isn't visible without it, parent or not.
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
  .post(
    '/ws-ticket',
    ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      return { ticket: createWebSocketTicket(user), expiresInSeconds: 30 };
    },
    {
      response: {
        200: t.Object({ ticket: t.String(), expiresInSeconds: t.Number() }),
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Issue a short-lived WebSocket ticket',
        description:
          'Exchanges the current session for a single-use ticket (30s) that GET /api/ws/events accepts as its auth credential - WebSocket connections cannot carry an Authorization header.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/login',
    async ({ jwt, jwtRefresh, body, cookie, request, server }) => {
      const { username, password } = body;
      // Every sign-in that succeeds or is refused is on the access record: the time, the address, and the account
      // (or the name tried, when no account has it). Written after the answer, so it never holds the request up.
      const ip = requestAddress(request, server);

      if (!(await loginAttemptLimiter.registerAttempt(username))) {
        accessRecordService.record({ event: 'login_failed', ip, username });
        throw new AppError(401, 'Invalid credentials');
      }

      // isDeleted excluded here (not just checked after the fact) so a soft-deleted account
      // fails exactly like a nonexistent one - both credentials-wise and message-wise -
      // instead of successfully logging in and only getting blocked by admin-gated routes.
      const user = await userService.findLiveByUsername(username);

      if (!user) {
        accessRecordService.record({ event: 'login_failed', ip, username });
        throw new AppError(401, 'Invalid credentials');
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        accessRecordService.record({ event: 'login_failed', ip, userId: user.id });
        throw new AppError(401, 'Invalid credentials');
      }

      await loginAttemptLimiter.clearAttempts(username);

      // A pending account can sign in - that is how it finds its own verification - but its session is pending too.
      const pending = user.verificationStatus !== 'active';
      const accessToken = await jwt.sign({
        userId: user.id,
        username: user.username,
        ...pendingClaim(pending),
      });
      const refreshToken = await jwtRefresh.sign({
        userId: user.id,
        username: user.username,
        ...pendingClaim(pending),
      });

      // The cookies belong to the web client this server hosts, and there is one pair per origin: the
      // admin panel and the public site keep their own token and ask for none, or signing in there
      // would swap the account the web client is using (and signing out there would end its session).
      if (body.session !== 'token') {
        setSessionCookies(cookie, accessToken, refreshToken);
      }

      accessRecordService.record({ event: 'login', ip, userId: user.id });
      return { accessToken, refreshToken, userId: user.id, username: user.username, tag: user.tag };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        session: t.Optional(t.Union([t.Literal('cookie'), t.Literal('token')])),
      }),
      response: {
        200: AuthSessionResponseSchema,
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'User login',
        description:
          "By default the session is also kept in HttpOnly cookies (the web client hosted by this server). `session: 'token'` returns the tokens only and sets no cookie: for callers that keep their own token and must not touch the web client's session.",
        tags: ['Auth'],
      },
    },
  )
  .get(
    '/terms-status',
    async ({ user }) => {
      if (!user || !user.userId) {
        throw new AppError(401, 'Unauthorized: User not authenticated.');
      }
      return termsAcceptanceService.status(user.userId);
    },
    {
      response: {
        200: TermsStatusResponseSchema,
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Legal document acceptance status',
        description:
          'Which version of the terms and the privacy policy this account accepted, against the current ones. The client re-presents whatever is newer than the acceptance.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/terms-accept',
    async ({ user, body }) => {
      if (!user || !user.userId) {
        throw new AppError(401, 'Unauthorized: User not authenticated.');
      }
      // The version recorded is always the current one: the client shows the current text and
      // the server names what it serves, so a claim about any other version has no meaning here.
      await termsAcceptanceService.recordAcceptance(user.userId, body.kind, 'reaccept');
      return termsAcceptanceService.status(user.userId);
    },
    {
      body: t.Object({ kind: t.Union([t.Literal('tos'), t.Literal('privacy')]) }),
      response: {
        200: TermsStatusResponseSchema,
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Accept the current legal documents',
        description:
          'Records acceptance of the current terms or privacy policy after the client presented them. A version bump is a new row, never a rewrite.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/register',
    async ({ jwt, jwtRefresh, body, cookie, request, server }) => {
      const { username, password } = body;

      // The same address the access record keeps; behind a proxy that is the forwarded one, not the proxy's own.
      const ip = requestAddress(request, server);
      if (!(await registrationLimiter.registerAttempt(ip ?? 'unknown'))) {
        throw new AppError(429, 'Too many attempts. Try again later.');
      }

      // Evaluated live on every attempt (see RegistrationSettingsService) rather than trusting a boolean
      // that would go stale as soon as the user ceiling was reached in automatic management mode.
      const isOpen = await registrationSettingsService.isOpenForRegistration();
      if (!isOpen) {
        throw new AppError(403, 'Registration is currently closed.');
      }

      if (await userService.isUsernameTaken(username)) {
        throw new AppError(409, 'User already exists');
      }

      // In `required` mode the service is asked for the sending first: no account exists unless it accepted one.
      const verified = isAgeVerificationRequired();
      const newUserId = ulid();
      const sending = verified
        ? await requestSendingFor(
            newUserId,
            username,
            languageOf(request.headers.get('accept-language')),
          )
        : null;

      const hashedPassword = await hashPassword(password);
      const defaultTierId = await effectiveDefaultTierId();

      // Seed the @tag with the username so every account has a valid one from the
      // start - the user can freely change it later via PUT /user/tag. On the rare
      // chance someone already claimed this exact string as their tag (tags and
      // usernames share no uniqueness guarantee with each other), fall back to a
      // short unique suffix rather than failing registration outright.
      const newUser = await createRegisteredAccount(
        { id: newUserId, username, hashedPassword, defaultTierId },
        sending,
      );

      if (newUser === 'taken') {
        throw new AppError(409, 'User already exists');
      }

      // Shown only now, in plain text - after this only each one's hash exists (see RecoveryCodeService).
      // It is this user's only chance to save them.
      const recoveryCodes = await recoveryCodeService.generateCodes(newUser.id);

      // The account is born under the current texts: the gate on the client showed them, and
      // this row is the server's own proof of who accepted which version when. Recorded here,
      // not trusted from the request - a client could claim any version.
      await termsAcceptanceService.recordAcceptance(newUser.id, 'tos', 'registration');
      await termsAcceptanceService.recordAcceptance(newUser.id, 'privacy', 'registration');

      // Pending exactly when the account is not active - read back, not assumed from the mode.
      const pending = await userService.isPendingVerification(newUser.id);
      const accessToken = await jwt.sign({
        userId: newUser.id,
        username: newUser.username,
        ...pendingClaim(pending),
      });
      const refreshToken = await jwtRefresh.sign({
        userId: newUser.id,
        username: newUser.username,
        ...pendingClaim(pending),
      });

      setSessionCookies(cookie, accessToken, refreshToken);
      accessRecordService.record({ event: 'register', ip, userId: newUser.id });

      // Where verification is off there is nothing to report: the response is the one it always was.
      const verification = verified
        ? await ageVerificationService.statusFor(newUser.id)
        : undefined;

      return {
        accessToken,
        refreshToken,
        userId: newUser.id,
        username: newUser.username,
        tag: newUser.tag,
        recoveryCodes,
        ...(verification ? { verification } : {}),
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      response: {
        200: t.Composite([
          AuthSessionResponseSchema,
          t.Object({
            recoveryCodes: t.Array(t.String()),
            verification: t.Optional(AccountVerificationStatusResponseSchema),
          }),
        ]),
        403: MessageResponseSchema,
        409: MessageResponseSchema,
        429: MessageResponseSchema,
        500: MessageResponseSchema,
        503: CodedMessageResponseSchema,
      },
      detail: {
        summary: 'User registration',
        description:
          'Also issues a batch of one-time recovery codes (`recoveryCodes`), returned only in this response - store them, they cannot be retrieved again later.',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/forgot-password',
    async ({ jwt, jwtRefresh, body, cookie, request, server }) => {
      const parsedBody = ForgotPasswordSchema.safeParse(body);
      if (!parsedBody.success) {
        throw new AppError(400, parsedBody.error.issues[0]?.message || 'Invalid request');
      }
      const { username, recoveryCode, newPassword } = parsedBody.data;
      const ip = requestAddress(request, server);

      let user: { id: string; username: string; tag: string };
      try {
        user = await recoveryCodeService.redeemCode(username, recoveryCode, newPassword);
      } catch (error) {
        if (
          error instanceof InvalidRecoveryCodeError ||
          error instanceof RecoveryAttemptsLockedError
        ) {
          accessRecordService.record({ event: 'password_recovery_failed', ip, username });
        }
        if (error instanceof InvalidRecoveryCodeError) {
          throw new AppError(401, error.message);
        }
        if (error instanceof RecoveryAttemptsLockedError) {
          throw new AppError(429, error.message);
        }
        throw error;
      }

      // The same response as /login: the person has just proved who they are as well as a password would,
      // so it makes no sense to ask them to log in again right afterwards.
      const pending = await userService.isPendingVerification(user.id);
      const accessToken = await jwt.sign({
        userId: user.id,
        username: user.username,
        ...pendingClaim(pending),
      });
      const refreshToken = await jwtRefresh.sign({
        userId: user.id,
        username: user.username,
        ...pendingClaim(pending),
      });

      setSessionCookies(cookie, accessToken, refreshToken);
      accessRecordService.record({ event: 'password_recovery', ip, userId: user.id });

      return { accessToken, refreshToken, userId: user.id, username: user.username, tag: user.tag };
    },
    {
      body: t.Object({
        username: t.String(),
        recoveryCode: t.String(),
        newPassword: t.String(),
      }),
      response: {
        200: AuthSessionResponseSchema,
        400: MessageResponseSchema,
        401: MessageResponseSchema,
        429: MessageResponseSchema,
      },
      detail: {
        summary: 'Reset a forgotten password using a recovery code',
        description:
          'Consumes one unused recovery code (issued at registration or via regeneration) and sets a new password. Logs the user in on success, same response shape as /login.',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/refresh',
    async ({ jwt, jwtRefresh, body, cookie, request, server }) => {
      // Destructure jwtRefresh and cookie
      let refreshToken: string | undefined = body.refreshToken;

      if (!refreshToken && typeof cookie['refresh_token'].value === 'string') {
        refreshToken = cookie['refresh_token'].value;
      }

      if (!refreshToken) {
        throw new AppError(401, 'Refresh token not found');
      }

      const payload = await jwtRefresh.verify(refreshToken);

      if (!payload || !payload.userId || !payload.username) {
        throw new AppError(401, 'Invalid or expired refresh token');
      }

      // The refresh JWT alone only proves this token was validly issued at some point in the
      // past - it says nothing about whether the account still exists or is still enabled.
      // Without re-checking the DB here, a deleted/banned user keeps minting fresh access
      // tokens off their still-valid refresh token indefinitely (there is no revocation list).
      if (!(await userService.isLiveUser(payload.userId))) {
        throw new AppError(401, 'Invalid or expired refresh token');
      }

      // Read now: a session stays pending until the account is active, and a pending one is renewed as pending.
      const pending = await userService.isPendingVerification(payload.userId);
      const newAccessToken = await jwt.sign({
        userId: payload.userId,
        username: payload.username,
        ...pendingClaim(pending),
      });
      const newRefreshToken = await jwtRefresh.sign({
        userId: payload.userId,
        username: payload.username,
        ...pendingClaim(pending),
      });

      setSessionCookies(cookie, newAccessToken, newRefreshToken);
      // Only a renewal that went through is on the record: a refused one established nothing.
      accessRecordService.record({
        event: 'token_refresh',
        ip: requestAddress(request, server),
        userId: payload.userId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        username: payload.username,
      };
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          accessToken: t.String(),
          refreshToken: t.String(),
          username: t.String(),
        }),
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Refresh access token',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/logout',
    ({ cookie }) => {
      // Same path/flags as login/refresh so the browser actually drops the cookies.
      // Always 200: logout is idempotent whether a session existed or not.
      const clear = {
        value: '',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 0,
      };
      cookie['access_token'].set(clear);
      cookie['refresh_token'].set(clear);
      return { message: 'Logged out' };
    },
    {
      response: {
        200: MessageResponseSchema,
      },
      detail: {
        summary: 'Clear session cookies',
        description:
          'Clears httpOnly access_token and refresh_token cookies, which belong to the hosted web client. Idempotent. The admin panel and the public site do not call it: they sign in for the token only and forget it locally.',
        tags: ['Auth'],
      },
    },
  )
  .use(authVerificationRoutes)
  .get(
    '/me',
    async ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      const found = await userService.getUserById(user.userId);
      if (!found || found.id !== user.userId) {
        throw new AppError(401, 'Unauthorized');
      }
      // Read apart from the public shape: the owner's private preference, never shown to anybody else.
      const preferences = await userService.getPreferences(user.userId);
      return {
        userId: found.id,
        username: found.username,
        tag: found.tag,
        isAdultVerified: found.isAdultVerified,
        showNsfw: preferences?.showNsfw ?? false,
      };
    },
    {
      response: {
        200: t.Object({
          userId: t.String(),
          username: t.String(),
          tag: t.String(),
          isAdultVerified: t.Boolean(),
          showNsfw: t.Boolean(),
        }),
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'Current session',
        description:
          'Returns the signed-in account from the Bearer token or the HttpOnly session cookie. Used by the co-hosted web client after a reload, when JavaScript no longer holds the JWT.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
