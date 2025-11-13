import { bearer } from '@elysiajs/bearer';
import { jwt } from '@elysiajs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { env } from '../../config/env';
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
  .use(bearer())
  .post(
    '/login',
    async ({ jwt, body, set }) => {
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

      // Sign JWT with userId and email as per the schema defined in index.ts
      const token = await jwt.sign({ userId: user.id, username: user.username }); // Assuming username is used as email for now

      return { token };
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
    async ({ jwt, body, set }) => {
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

      // Sign JWT with userId and email as per the schema defined in index.ts
      const token = await jwt.sign({ userId: newUser.id, username: newUser.username });

      return { token };
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
  );
