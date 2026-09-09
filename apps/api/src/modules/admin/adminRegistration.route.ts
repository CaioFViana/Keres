import { UpdateRegistrationSettingsSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { registrationSettingsService } from '../../services/RegistrationSettingsService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

export const adminRegistrationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ user }) => {
      await requireAdmin(user);
      return registrationSettingsService.getOrCreate();
    },
    {
      detail: {
        summary: 'Get registration settings (open/closed signup, max users, default tier)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .put(
    '/',
    async ({ body, user }) => {
      await requireAdmin(user);

      const parsed = UpdateRegistrationSettingsSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid registration settings');
      }

      return registrationSettingsService.update(parsed.data);
    },
    {
      // Loose on purpose - UpdateRegistrationSettingsSchema.safeParse above stays the real
      // gate. Only exists so swagger shows the body shape; Elysia strips undeclared body keys
      // before the handler runs, so this must include every field the Zod schema does.
      body: t.Object({
        isRegistrationOpen: t.Optional(t.Boolean()),
        maxUsers: t.Optional(t.Nullable(t.Number())),
        autoManage: t.Optional(t.Boolean()),
        defaultTierId: t.Optional(t.Nullable(t.String())),
      }),
      detail: {
        summary: 'Update registration settings',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
