import { bearer } from '@elysiajs/bearer';
import { jwt } from '@elysiajs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { env } from '../../config/env';
import { jwtRefresh } from '../../config/jwt';
import { db } from '../../db';
import { users } from '../../db/schema';

export const authRoutes = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: '1h', // Access token expiration, consistent with index.ts
      schema: t.Object({ // Define schema for JWT payload, consistent with index.ts
        userId: t.String(),
        username: t.String(),
      })
    })
  )
  .use(jwtRefresh) // Register jwtRefresh plugin
  .use(bearer())
  .post(
    '/login',
    async ({ jwt, jwtRefresh, body, set, cookie }) => { // Destructure jwtRefresh and cookie
      const { username, password } = body;

      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
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

      // Sign JWT with userId and username as per the schema defined in index.ts
      const accessToken = await jwt.sign({ userId: user.id, username: user.username });
      const refreshToken = await jwtRefresh.sign({ userId: user.id, username: user.username }); // Use jwtRefresh for refresh token

      cookie['access_token'].set({
        value: accessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
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
      detail: {
        summary: 'User login',
        tags: ['Auth'],
      },
    }
  )
  .post(
    '/register',
    async ({ jwt, jwtRefresh, body, set, cookie }) => { // Destructure jwtRefresh and cookie
      const { username, password } = body;

      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUser) {
        set.status = 409;
        return { message: 'User already exists' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUserId = ulid();

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
          })
          .returning({ id: users.id, username: users.username, tag: users.tag });
      } catch (error) {
        if ((error as { code?: string })?.code === '23505') {
          [newUser] = await db
            .insert(users)
            .values({
              id: newUserId,
              username,
              tag: `${username}${newUserId.slice(-4)}`,
              password: hashedPassword,
            })
            .returning({ id: users.id, username: users.username, tag: users.tag });
        } else {
          throw error;
        }
      }

      if (!newUser) {
        set.status = 500;
        return { message: 'Failed to create user' };
      }

      // Sign JWT with userId and username as per the schema defined in index.ts
      const accessToken = await jwt.sign({ userId: newUser.id, username: newUser.username });
      const refreshToken = await jwtRefresh.sign({ userId: newUser.id, username: newUser.username }); // Use jwtRefresh for refresh token

      cookie['access_token'].set({
        value: accessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return { accessToken, refreshToken, userId: newUser.id, username: newUser.username, tag: newUser.tag };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      detail: {
        summary: 'User registration',
        tags: ['Auth'],
      },
    }
  )
  .post(
    '/refresh',
    async ({ jwt, jwtRefresh, body, set, cookie }) => { // Destructure jwtRefresh and cookie
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

      // Sign a new access token with the payload from the refresh token
      const newAccessToken = await jwt.sign({ userId: payload.userId, username: payload.username });
      const newRefreshToken = await jwtRefresh.sign({ userId: payload.userId, username: payload.username }); // Generate a new refresh token

      cookie['access_token'].set({
        value: newAccessToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: 3600, // 1 hour
      });

      cookie['refresh_token'].set({
        value: newRefreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken, username: payload.username };
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Refresh access token',
        tags: ['Auth'],
      },
    }
  );
