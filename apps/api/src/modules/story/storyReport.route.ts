import { REPORT_TYPES, StoryReportRequestSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '@/index';
import { messageService } from '@/services/MessageService';
import { AppError } from '@/utils/errors';

const reportTypeField = t.Optional(
  t.Union([
    t.Literal('intimate'),
    t.Literal('copyright'),
    t.Literal('spam_abuse'),
    t.Literal('illegal'),
    t.Literal('other'),
  ]),
);

/**
 * Reporting a story to the administrators, mounted at `/api/stories/:storyId/report`.
 *
 * The client sends the type and the free-text reason: the story id comes from the route, and the
 * server wraps all three into an `admin`-channel message (see `MessageService.reportStory`), so
 * the id is always the story being viewed - never a field the client could forge. Only a
 * non-owner may report; the quota is the administrators-channel one, shared with ordinary
 * messages to them.
 */
export const storyReportRoutes = new Elysia().decorate('user', null as JWTPayload | null).post(
  '/:storyId/report',
  async ({ params, body, user, set }) => {
    if (!user || !user.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    const parsed = StoryReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid report');
    }
    await messageService.reportStory(
      user.userId,
      params.storyId,
      parsed.data.reason,
      parsed.data.type,
    );
    set.status = 201;
    return { ok: true };
  },
  {
    params: t.Object({ storyId: t.String() }),
    body: t.Object({ reason: t.String(), type: reportTypeField }),
    response: { 201: t.Object({ ok: t.Boolean() }) },
    detail: {
      summary: 'Report a story to the administrators',
      description: `Sends the type and reason to the administrators as a message carrying this story id. Only a non-owner may report. Type is one of ${REPORT_TYPES.join(', ')}.`,
      tags: ['Story'],
    },
  },
);
