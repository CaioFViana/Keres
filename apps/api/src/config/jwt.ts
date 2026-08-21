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
 * Token de acesso a uma história do Showcase protegida por senha.
 *
 * Segredo derivado do principal em vez de uma variável de ambiente nova - assim ninguém
 * precisa configurar mais nada - mas *diferente* dele de propósito: um token de vitrine não
 * pode ser aceito como token de sessão, nem o contrário, mesmo que os payloads passassem
 * despercebidos pela validação de schema.
 */
export const jwtShowcase = jwt({
  name: 'jwtShowcase',
  secret: `${env.JWT_SECRET}:showcase`,
  exp: '1h',
  schema: t.Object({
    storyId: t.String(),
  }),
});
