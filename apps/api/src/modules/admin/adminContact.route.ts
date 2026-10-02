import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { ContactNotFoundError, contactService } from '../../services/ContactService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

export const adminContactRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ user }) => {
      await requireAdmin(user);
      return contactService.list();
    },
    {
      detail: {
        summary: 'List contact messages (newest first)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .get(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      try {
        return await contactService.getAndMarkRead(params.id);
      } catch (error) {
        if (error instanceof ContactNotFoundError) {
          throw new AppError(404, error.message);
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Read a contact message (marks it read)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .delete(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      try {
        return await contactService.remove(params.id);
      } catch (error) {
        if (error instanceof ContactNotFoundError) {
          throw new AppError(404, error.message);
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Delete a contact message',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
