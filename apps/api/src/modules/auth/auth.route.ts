import { jwt } from '@elysiajs/jwt';
import { ForgotPasswordSchema } from '@keres/shared';
import * as bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { BCRYPT_COST } from '../../config/bcrypt';
import { env } from '../../config/env';
import { jwtRefresh } from '../../config/jwt';
import { db } from '../../db';
import { users } from '../../db/schema';
import { InvalidRecoveryCodeError, recoveryCodeService } from '../../services/RecoveryCodeService';
import { registrationSettingsService } from '../../services/RegistrationSettingsService';
import { isUniqueViolation, postgresErrorConstraint } from '../../utils/errors';
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
          'Exchanges the current session for a single-use ticket (30s) that GET /ws/events accepts as its auth credential - WebSocket connections cannot carry an Authorization header.',
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
      const user = await db.query.users.findFirst({
        where: and(eq(users.username, username), eq(users.isDeleted, false)),
      });

      if (!user) {
        set.status = 401;
        return { message: 'Invalid credentials' };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

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

      // Avaliado ao vivo a cada tentativa (ver RegistrationSettingsService) em vez de
      // confiar num booleano que ficaria desatualizado assim que o teto de usuários fosse
      // atingido no modo de gestão automática.
      const isOpen = await registrationSettingsService.isOpenForRegistration();
      if (!isOpen) {
        set.status = 403;
        return { message: 'Registration is currently closed.' };
      }

      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUser) {
        set.status = 409;
        return { message: 'User already exists' };
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);
      const newUserId = ulid();
      const { defaultTierId } = await registrationSettingsService.getOrCreate();

      // Seed the @tag with the username so every account has a valid one from the
      // start - the user can freely change it later via PUT /user/tag. On the rare
      // chance someone already claimed this exact string as their tag (tags and
      // usernames share no uniqueness guarantee with each other), fall back to a
      // short unique suffix rather than failing registration outright.
      let newUser;
      try {
        [newUser] = await db
          .insert(users)
          .values({
            id: newUserId,
            username,
            tag: username,
            password: hashedPassword,
            tierId: defaultTierId,
          })
          .returning({ id: users.id, username: users.username, tag: users.tag });
      } catch (error) {
        if (isUniqueViolation(error) && postgresErrorConstraint(error) === 'users_tag_lower_idx') {
          [newUser] = await db
            .insert(users)
            .values({
              id: newUserId,
              username,
              tag: `${username}${newUserId.slice(-4)}`,
              password: hashedPassword,
              tierId: defaultTierId,
            })
            .returning({ id: users.id, username: users.username, tag: users.tag });
        } else if (isUniqueViolation(error)) {
          // Not the tag constraint - a concurrent registration for this exact username
          // landed between the pre-check above and this insert. Blindly retrying with a
          // suffixed tag (the tag-collision path) would just fail again on the *username*
          // constraint, this time as an unhandled error instead of a clean response.
          set.status = 409;
          return { message: 'User already exists' };
        } else {
          throw error;
        }
      }

      if (!newUser) {
        set.status = 500;
        return { message: 'Failed to create user' };
      }

      // Mostrados só agora, em texto puro - depois disto só o hash de cada um existe (ver
      // RecoveryCodeService). É a única chance que este usuário tem de salvá-los.
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

      // Mesma resposta de /login: a pessoa acabou de provar quem é tão bem quanto uma senha
      // provaria, não faz sentido pedir pra ela logar de novo em seguida.
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
      const dbUser = await db.query.users.findFirst({
        where: and(eq(users.id, payload.userId), eq(users.isDeleted, false)),
        columns: { id: true },
      });
      if (!dbUser) {
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
  );
