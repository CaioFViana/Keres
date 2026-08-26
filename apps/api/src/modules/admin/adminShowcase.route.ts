import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { requireAdmin } from '../../utils/adminAuth';

/**
 * The public site's switch, in the hands of whoever hosts the server.
 *
 * The showcase can be turned off without erasing what has already been published. The client hosted
 * at `/` has a control of its own and, when off, gives way to the server's minimal landing page.
 */
export const adminShowcaseRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ user }) => {
      await requireAdmin(user);
      return showcaseSettingsService.getOrCreate();
    },
    {
      detail: {
        summary: 'Get showcase settings',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .put(
    '/',
    async ({ body, user }) => {
      await requireAdmin(user);
      return showcaseSettingsService.update(body);
    },
    {
      body: t.Partial(
        t.Object({
          isShowcaseEnabled: t.Boolean(),
          isHostedClientEnabled: t.Boolean(),
        }),
      ),
      detail: {
        summary: 'Configure the hosted client and public showcase',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
