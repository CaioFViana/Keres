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
    async ({ jwt, jwtRefresh, body, set }) => { // Destructure jwtRefresh
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

      return { accessToken, refreshToken, username: user.username };
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
    async ({ jwt, jwtRefresh, body, set }) => { // Destructure jwtRefresh
      const { username, password } = body;

      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUser) {
        set.status = 409;
        return { message: 'User already exists' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await db
        .insert(users)
        .values({
          id: ulid(),
          username,
          password: hashedPassword,
        })
        .returning({ id: users.id, username: users.username });

      if (!newUser) {
        set.status = 500;
        return { message: 'Failed to create user' };
      }

      // Sign JWT with userId and username as per the schema defined in index.ts
      const accessToken = await jwt.sign({ userId: newUser.id, username: newUser.username });
      const refreshToken = await jwtRefresh.sign({ userId: newUser.id, username: newUser.username }); // Use jwtRefresh for refresh token

      return { accessToken, refreshToken, username: newUser.username };
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
    async ({ jwt, jwtRefresh, body, set }) => { // Destructure jwtRefresh
      const { refreshToken } = body;

      const payload = await jwtRefresh.verify(refreshToken); // Use jwtRefresh to verify

      if (!payload || !payload.userId || !payload.username) {
        set.status = 401;
        return { message: 'Invalid or expired refresh token' };
      }

      // Sign a new access token with the payload from the refresh token
      const newAccessToken = await jwt.sign({ userId: payload.userId, username: payload.username });

      return { accessToken: newAccessToken, username: payload.username };
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      detail: {
        summary: 'Refresh access token',
        tags: ['Auth'],
      },
    }
  );
