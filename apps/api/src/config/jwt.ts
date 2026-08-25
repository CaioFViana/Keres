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

/**
 * Access token for a password-protected Showcase story.
 *
 * The secret is derived from the main one rather than a new environment variable - so nobody has to
 * configure anything else - but *different* from it on purpose: a showcase token must not be accepted
 * as a session token, nor the other way around, even if the payloads happened to slip past schema
 * validation.
 */
export const jwtShowcase = jwt({
  name: 'jwtShowcase',
  secret: `${env.JWT_SECRET}:showcase`,
  exp: '1h',
  schema: t.Object({
    storyId: t.String(),
  }),
});
