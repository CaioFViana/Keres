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
      // Loose on purpose - AdminUserListQuerySchema.safeParse above stays the real gate. Only
      // exists so swagger shows the query shape; Elysia strips undeclared query keys before
      // the handler runs, so this must include every field the Zod schema does.
      query: t.Object({
        search: t.Optional(t.String()),
        isAdmin: t.Optional(t.String()),
        isDeleted: t.Optional(t.String()),
        tierId: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
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
      // Mirrors AdminCreateUserSchema's length constraints (username/password), which the Zod
      // parse above still re-enforces - kept in sync here so the two don't drift silently
      // (this used to be looser than the real gate: no minLength anywhere, so swagger implied
      // an empty password was fine). `tierId`'s ULID format isn't worth replicating in
      // TypeBox; the Zod check still catches a malformed one.
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
        tag: t.Optional(t.String({ minLength: 1 })),
        isAdmin: t.Optional(t.Boolean()),
        tierId: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        201: t.Object({
          id: t.String(),
          username: t.String(),
          tag: t.String(),
          avatarColor: t.Nullable(t.String()),
          avatarIcon: t.Nullable(t.String()),
          bio: t.Nullable(t.String()),
          isAdmin: t.Boolean(),
          tierId: t.Nullable(t.String()),
          createdAt: t.Date(),
          updatedAt: t.Date(),
          isDeleted: t.Boolean(),
          deletedAt: t.Nullable(t.Date()),
          recoveryCodes: t.Array(t.String()),
        }),
        400: t.Object({ message: t.String() }),
        409: t.Object({ message: t.String() }),
      },
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
      // Mirrors AdminUpdateUserSchema's constraints (tag/bio length), same reasoning as
      // POST / above.
      body: t.Object({
        isAdmin: t.Optional(t.Boolean()),
        tierId: t.Optional(t.Nullable(t.String())),
        tag: t.Optional(t.String({ minLength: 1 })),
        avatarColor: t.Optional(t.Nullable(t.String())),
        avatarIcon: t.Optional(t.Nullable(t.String())),
        bio: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          username: t.String(),
          tag: t.String(),
          avatarColor: t.Nullable(t.String()),
          avatarIcon: t.Nullable(t.String()),
          bio: t.Nullable(t.String()),
          isAdmin: t.Boolean(),
          tierId: t.Nullable(t.String()),
          createdAt: t.Date(),
          updatedAt: t.Date(),
          isDeleted: t.Boolean(),
          deletedAt: t.Nullable(t.Date()),
        }),
        400: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
        409: t.Object({ message: t.String() }),
      },
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
