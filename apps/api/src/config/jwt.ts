import { jwt } from '@elysiajs/jwt';
import { t } from 'elysia';
import { env } from './env';

export const jwtRefresh = jwt({
  name: 'jwtRefresh',
  secret: env.JWT_SECRET_REFRESH, // This will need to be added to your .env file
  exp: '7d', // Longer expiration for refresh tokens
  schema: t.Object({
    userId: t.String(),
    username: t.String(), // Include username in refresh token payload for convenience
  }),
});
