import {
  EVIDENCE_HOLD_MAX_DAYS,
  EVIDENCE_HOLD_MAX_NOTE,
  EVIDENCE_HOLD_TARGETS,
} from '@keres/shared/metadata/EvidenceHolds';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '@/index';
import { evidenceHoldService } from '@/services/EvidenceHoldService';
import { requireAdmin } from '@/utils/adminAuth';
import { AppError } from '@/utils/errors';

const security = [{ bearerAuth: [] }];

/**
 * The evidence holds for the administrators, mounted at `/api/admin/evidence-holds` (see `EvidenceHoldService`):
 * the list, one hold with its snapshot, a hold made by hand for any report, an extension when an authority asks, and
 * letting one go when the report was unfounded. Each of these is on the activity record by the request audit.
 */
export const adminEvidenceHoldsRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      return {
        items: await evidenceHoldService.list(query.limit, query.includeExpired === 'true'),
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        includeExpired: t.Optional(t.String()),
      }),
      detail: { summary: 'The evidence holds, newest first', tags: ['Admin'], security },
    },
  )

  .get(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      return evidenceHoldService.get(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: 'One evidence hold with its snapshot', tags: ['Admin'], security },
    },
  )

  .post(
    '/',
    async ({ body, user, set }) => {
      const adminId = await requireAdmin(user);
      if (!(EVIDENCE_HOLD_TARGETS as readonly string[]).includes(body.targetKind)) {
        throw new AppError(400, `targetKind must be one of ${EVIDENCE_HOLD_TARGETS.join(', ')}.`);
      }
      set.status = 201;
      return evidenceHoldService.createByAdmin(adminId, {
        targetKind: body.targetKind as (typeof EVIDENCE_HOLD_TARGETS)[number],
        targetId: body.targetId,
        reportMessageId: body.reportMessageId ?? null,
        note: body.note ?? null,
      });
    },
    {
      body: t.Object({
        targetKind: t.String(),
        targetId: t.String({ minLength: 1, maxLength: 64 }),
        reportMessageId: t.Optional(t.String({ maxLength: 64 })),
        note: t.Optional(t.String({ maxLength: EVIDENCE_HOLD_MAX_NOTE })),
      }),
      detail: {
        summary:
          'Keep a reported item as it is now (any report; `illegal` ones are held by the server)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .post(
    '/:id/extend',
    async ({ params, body, user }) => {
      await requireAdmin(user);
      return evidenceHoldService.extend(params.id, body.days);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        days: t.Integer({ minimum: 1, maximum: EVIDENCE_HOLD_MAX_DAYS }),
      }),
      detail: {
        summary: 'Keep a hold longer, when an authority asks (Lei 15.211 art. 27, par. 3)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .delete(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      await evidenceHoldService.release(params.id);
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Let a hold go before it expires (the report was unfounded)',
        tags: ['Admin'],
        security,
      },
    },
  );
