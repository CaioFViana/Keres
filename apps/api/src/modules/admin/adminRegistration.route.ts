import { UpdateRegistrationSettingsSchema } from '@keres/shared';
import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { registrationSettingsService } from '../../services/RegistrationSettingsService';
import { requireAdmin } from '../../utils/adminAuth';

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
    async ({ body, user, set }) => {
      await requireAdmin(user);

      const parsed = UpdateRegistrationSettingsSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid registration settings' };
      }

      return registrationSettingsService.update(parsed.data);
    },
    {
      detail: {
        summary: 'Update registration settings',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
