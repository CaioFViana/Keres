import {
  AdminCreateUserSchema,
  AdminUpdateUserSchema,
  AdminUserListQuerySchema,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import {
  AdminUserNotFoundError,
  adminUserService,
  RootAdminProtectedError,
  UsernameAlreadyTakenError,
} from '../../services/AdminUserService';
import { requireAdmin } from '../../utils/adminAuth';

export const adminUserRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminUserListQuerySchema.safeParse(query);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid query' };
      }

      return adminUserService.list(parsed.data);
    },
    {
      detail: {
        summary: 'List users (paginated, filterable)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .get(
    '/:id',
    async ({ params, user, set }) => {
      await requireAdmin(user);

      const found = await adminUserService.getById(params.id);
      if (!found) {
        set.status = 404;
        return { message: 'User not found' };
      }
      return found;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: 'Get a user by ID', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .post(
    '/',
    async ({ body, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminCreateUserSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid user data' };
      }

      try {
        const created = await adminUserService.create(parsed.data);
        set.status = 201;
        return created;
      } catch (error) {
        if (error instanceof UsernameAlreadyTakenError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        tag: t.Optional(t.String()),
        isAdmin: t.Optional(t.Boolean()),
        tierId: t.Optional(t.Nullable(t.String())),
      }),
      detail: { summary: 'Create a user', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .put(
    '/:id',
    async ({ params, body, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminUpdateUserSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid user data' };
      }

      try {
        const updated = await adminUserService.update(params.id, parsed.data);
        return updated;
      } catch (error) {
        if (error instanceof AdminUserNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        if (error instanceof RootAdminProtectedError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        isAdmin: t.Optional(t.Boolean()),
        tierId: t.Optional(t.Nullable(t.String())),
        tag: t.Optional(t.String()),
        avatarColor: t.Optional(t.Nullable(t.String())),
        avatarIcon: t.Optional(t.Nullable(t.String())),
        bio: t.Optional(t.Nullable(t.String())),
      }),
      detail: {
        summary: 'Update a user (profile, isAdmin, tierId)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .delete(
    '/:id',
    async ({ params, user, set }) => {
      await requireAdmin(user);

      try {
        return await adminUserService.softDelete(params.id);
      } catch (error) {
        if (error instanceof AdminUserNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        if (error instanceof RootAdminProtectedError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: 'Soft-delete a user', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .post(
    '/:id/restore',
    async ({ params, user, set }) => {
      await requireAdmin(user);

      try {
        return await adminUserService.restore(params.id);
      } catch (error) {
        if (error instanceof AdminUserNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Restore a soft-deleted user',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .post(
    '/:id/regenerate-recovery-codes',
    async ({ params, user, set }) => {
      await requireAdmin(user);

      try {
        const recoveryCodes = await adminUserService.regenerateRecoveryCodes(params.id);
        return { recoveryCodes };
      } catch (error) {
        if (error instanceof AdminUserNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Regenerate a user's recovery codes",
        description:
          'Invalidates all previous recovery codes and issues a fresh batch, shown only in this response - no confirmation of the old password needed (admin action, not self-service).',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
