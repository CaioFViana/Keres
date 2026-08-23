import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { requireAdmin } from '../../utils/adminAuth';

/**
 * A chave do site público, na mão de quem hospeda o servidor.
 *
 * A vitrine pode ser desligada sem apagar o que já foi publicado. O cliente hospedado em `/`
 * tem controle próprio e, desligado, dá lugar à landing mínima do servidor.
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
