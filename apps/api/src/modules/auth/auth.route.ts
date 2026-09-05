import { jwt } from '@elysiajs/jwt';
import { ForgotPasswordSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { comparePassword, hashPassword } from '../../config/bcrypt';
import { env } from '../../config/env';
import { jwtRefresh } from '../../config/jwt';
import { InvalidRecoveryCodeError, recoveryCodeService } from '../../services/RecoveryCodeService';
import { registrationSettingsService } from '../../services/RegistrationSettingsService';
import { userService } from '../../services/UserService';
import { createAttemptLimiter } from '../../utils/rateLimiter';
import type { JWTPayload } from '../../index';
import { createWebSocketTicket } from '../webSocket/webSocket.route';

/** Same window as /forgot-password's limiter (RecoveryCodeService) - this one just never got
 *  backported when that concept was introduced, leaving /login the only credential-checking
 *  endpoint with no attempt limiting at all. */
const loginAttemptLimiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

/** Every rejection branch across this file returns exactly this shape. */
const MessageResponseSchema = t.Object({ message: t.String() });

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
    ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: 'Unauthorized' };
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
    async ({ jwt, jwtRefresh, body, set, cookie }) => {
      // Destructure jwtRefresh and cookie
      const { username, password } = body;

      if (!loginAttemptLimiter.registerAttempt(username)) {
        set.status = 401;
        return { message: 'Invalid credentials' };
      }

      // isDeleted excluded here (not just checked after the fact) so a soft-deleted account
      // fails exactly like a nonexistent one - both credentials-wise and message-wise -
      // instead of successfully logging in and only getting blocked by admin-gated routes.
      const user = await userService.findLiveByUsername(username);

      if (!user) {
        set.status = 401;
        return { message: 'Invalid credentials' };
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        set.status = 401;
        return { message: 'Invalid credentials' };
      }

      loginAttemptLimiter.clearAttempts(username);

      // Sign JWT with userId and username as per the schema defined in index.ts
      const accessToken = await jwt.sign({ userId: user.id, username: user.username });
      const refreshToken = await jwtRefresh.sign({ userId: user.id, username: user.username }); // Use jwtRefresh for refresh token

      cookie['access_token'].set({
        value: accessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return { accessToken, refreshToken, userId: user.id, username: user.username, tag: user.tag };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      response: {
        200: AuthSessionResponseSchema,
        401: MessageResponseSchema,
      },
      detail: {
        summary: 'User login',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/register',
    async ({ jwt, jwtRefresh, body, set, cookie }) => {
      // Destructure jwtRefresh and cookie
      const { username, password } = body;

      // Evaluated live on every attempt (see RegistrationSettingsService) rather than trusting a boolean
      // that would go stale as soon as the user ceiling was reached in automatic management mode.
      const isOpen = await registrationSettingsService.isOpenForRegistration();
      if (!isOpen) {
        set.status = 403;
        return { message: 'Registration is currently closed.' };
      }

      if (await userService.isUsernameTaken(username)) {
        set.status = 409;
        return { message: 'User already exists' };
      }

      const hashedPassword = await hashPassword(password);
      const newUserId = ulid();
      const { defaultTierId } = await registrationSettingsService.getOrCreate();

      // Seed the @tag with the username so every account has a valid one from the
      // start - the user can freely change it later via PUT /user/tag. On the rare
      // chance someone already claimed this exact string as their tag (tags and
      // usernames share no uniqueness guarantee with each other), fall back to a
      // short unique suffix rather than failing registration outright.
      const newUser = await userService.createAccount({
        id: newUserId,
        username,
        hashedPassword,
        defaultTierId,
      });

      if (newUser === 'taken') {
        set.status = 409;
        return { message: 'User already exists' };
      }

      // Shown only now, in plain text - after this only each one's hash exists (see RecoveryCodeService).
      // It is this user's only chance to save them.
      const recoveryCodes = await recoveryCodeService.generateCodes(newUser.id);

      // Sign JWT with userId and username as per the schema defined in index.ts
      const accessToken = await jwt.sign({ userId: newUser.id, username: newUser.username });
      const refreshToken = await jwtRefresh.sign({
        userId: newUser.id,
        username: newUser.username,
      }); // Use jwtRefresh for refresh token

      cookie['access_token'].set({
        value: accessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return {
        accessToken,
        refreshToken,
        userId: newUser.id,
        username: newUser.username,
        tag: newUser.tag,
        recoveryCodes,
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
          t.Object({ recoveryCodes: t.Array(t.String()) }),
        ]),
        403: MessageResponseSchema,
        409: MessageResponseSchema,
        500: MessageResponseSchema,
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
    async ({ jwt, jwtRefresh, body, set, cookie }) => {
      const parsedBody = ForgotPasswordSchema.safeParse(body);
      if (!parsedBody.success) {
        set.status = 400;
        return { message: parsedBody.error.issues[0]?.message || 'Invalid request' };
      }
      const { username, recoveryCode, newPassword } = parsedBody.data;

      let user: { id: string; username: string; tag: string };
      try {
        user = await recoveryCodeService.redeemCode(username, recoveryCode, newPassword);
      } catch (error) {
        if (error instanceof InvalidRecoveryCodeError) {
          set.status = 401;
          return { message: error.message };
        }
        throw error;
      }

      // The same response as /login: the person has just proved who they are as well as a password would,
      // so it makes no sense to ask them to log in again right afterwards.
      const accessToken = await jwt.sign({ userId: user.id, username: user.username });
      const refreshToken = await jwtRefresh.sign({ userId: user.id, username: user.username });

      cookie['access_token'].set({
        value: accessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      });
      cookie['refresh_token'].set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });

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
    async ({ jwt, jwtRefresh, body, set, cookie }) => {
      // Destructure jwtRefresh and cookie
      let refreshToken: string | undefined = body.refreshToken;

      if (!refreshToken && typeof cookie['refresh_token'].value === 'string') {
        refreshToken = cookie['refresh_token'].value;
      }

      if (!refreshToken) {
        set.status = 401;
        return { message: 'Refresh token not found' };
      }

      const payload = await jwtRefresh.verify(refreshToken); // Use jwtRefresh to verify

      if (!payload || !payload.userId || !payload.username) {
        set.status = 401;
        return { message: 'Invalid or expired refresh token' };
      }

      // The refresh JWT alone only proves this token was validly issued at some point in the
      // past - it says nothing about whether the account still exists or is still enabled.
      // Without re-checking the DB here, a deleted/banned user keeps minting fresh access
      // tokens off their still-valid refresh token indefinitely (there is no revocation list).
      if (!(await userService.isLiveUser(payload.userId))) {
        set.status = 401;
        return { message: 'Invalid or expired refresh token' };
      }

      // Sign a new access token with the payload from the refresh token
      const newAccessToken = await jwt.sign({ userId: payload.userId, username: payload.username });
      const newRefreshToken = await jwtRefresh.sign({
        userId: payload.userId,
        username: payload.username,
      }); // Generate a new refresh token

      cookie['access_token'].set({
        value: newAccessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: newRefreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
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
          'Clears httpOnly access_token and refresh_token cookies. Idempotent. The admin SPA also drops its Bearer token from localStorage on its side.',
        tags: ['Auth'],
      },
    },
  )
  .get(
    '/me',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: 'Unauthorized' };
      }
      const found = await userService.getUserById(user.userId);
      if (!found || found.id !== user.userId) {
        set.status = 401;
        return { message: 'Unauthorized' };
      }
      return { userId: found.id, username: found.username, tag: found.tag };
    },
    {
      response: {
        200: t.Object({
          userId: t.String(),
          username: t.String(),
          tag: t.String(),
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
