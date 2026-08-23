import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { requireAdmin } from '../../utils/adminAuth';

/**
 * A chave do site público, na mão de quem hospeda o servidor.
 *
 * Desligada, `/` volta a ser o atalho para o Swagger, `/api/public/*` responde 404 e publicar é
 * recusado - inclusive para histórias que já tinham versões, que simplesmente deixam de ser
 * alcançáveis sem serem apagadas.
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
      return showcaseSettingsService.update({ isShowcaseEnabled: body.isShowcaseEnabled });
    },
    {
      body: t.Object({ isShowcaseEnabled: t.Boolean() }),
      detail: {
        summary: 'Enable or disable the public showcase',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
