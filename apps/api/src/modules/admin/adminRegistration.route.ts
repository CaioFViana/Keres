import { type RegistrationSettingsView, UpdateRegistrationSettingsSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '@/index';
import { ageVerificationMode } from '@/services/age-verification/ageVerificationMode';
import { registrationSettingsService } from '@/services/admin/RegistrationSettingsService';
import { TierNotFoundError } from '@/services/tiers/TierService';
import { requireAdmin } from '@/utils/adminAuth';
import { AppError } from '@/utils/errors';

export const adminRegistrationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ user }): Promise<RegistrationSettingsView> => {
      await requireAdmin(user);
      // Read-only on purpose: the admin page must show the mode the adults-only switch depends on. The PUT
      // schema does not take it, so the mode can only ever be changed by the server's environment.
      const settings = await registrationSettingsService.getOrCreate();
      return { ...settings, ageVerificationMode: ageVerificationMode() };
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

      try {
        return await registrationSettingsService.update(parsed.data);
      } catch (error) {
        if (error instanceof TierNotFoundError) {
          throw new AppError(404, error.message);
        }
        throw error;
      }
    },
    {
      // Loose on purpose - UpdateRegistrationSettingsSchema.safeParse above stays the real
      // gate. Only exists so swagger shows the body shape; Elysia strips undeclared body keys
      // before the handler runs, so this must include every field the Zod schema does.
      body: t.Object({
        isRegistrationOpen: t.Optional(t.Boolean()),
        maxUsers: t.Optional(t.Nullable(t.Number())),
        autoManage: t.Optional(t.Boolean()),
        allowNsfw: t.Optional(t.Boolean()),
        requireAccountOnboarding: t.Optional(t.Boolean()),
        defaultTierId: t.Optional(t.Nullable(t.String())),
        currency: t.Optional(t.String()),
        // A string, not a union: the Zod schema is the gate, and an unknown mode answers 400 like the other fields.
        tiersDisplay: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Update registration settings',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
