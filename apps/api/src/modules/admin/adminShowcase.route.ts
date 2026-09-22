import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { showcaseLogoStorageService } from '../../services/ShowcaseLogoStorageService';
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
          siteName: t.String(),
          sitePalette: t.String(),
        }),
      ),
      detail: {
        summary: 'Configure the hosted client and public showcase',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .post(
    '/logo',
    async ({ body, user }) => {
      await requireAdmin(user);
      const file = body.logo;
      const contentType = (file.type || '').toLowerCase();
      // Bytes first: the key is fixed, so a failed row update leaves no orphan behind - the next
      // upload replaces it. Updating the row first would advertise a logo that 404s.
      await showcaseLogoStorageService.store(await file.arrayBuffer(), contentType);
      return showcaseSettingsService.setLogo(contentType);
    },
    {
      body: t.Object({ logo: t.File() }),
      type: 'multipart/form-data',
      detail: {
        summary: 'Upload the public site logo',
        description:
          'Replaces the showcase logo (PNG, JPEG or WebP, up to 512KB) and returns the updated settings.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .delete(
    '/logo',
    async ({ user }) => {
      await requireAdmin(user);
      await showcaseLogoStorageService.delete();
      return showcaseSettingsService.clearLogo();
    },
    {
      detail: {
        summary: 'Remove the public site logo',
        description: 'Deletes the logo bytes and returns the updated settings.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
