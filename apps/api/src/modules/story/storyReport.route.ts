import { StoryReportRequestSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { stories } from '../../db/schema';
import type { JWTPayload } from '../../index';
import { messageService } from '../../services/MessageService';
import { AppError } from '../../utils/errors';

/**
 * Reporting a story to the administrators, mounted at `/api/stories/:storyId/report`.
 *
 * The client sends only the free-text reason: the story id comes from the route, and the server
 * wraps both into an `admin`-channel message (see `MessageService.sendStoryReport`), so the id
 * is always the story being viewed - never a field the client could forge. Only a non-owner may
 * report; the quota is the administrators-channel one, shared with ordinary messages to them.
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
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, params.storyId),
      columns: { id: true, userId: true, isDeleted: true },
    });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId === user.userId) {
      throw new AppError(403, 'You cannot report your own story.');
    }
    await messageService.sendStoryReport(user.userId, story.id, parsed.data.reason);
    set.status = 201;
    return { ok: true };
  },
  {
    params: t.Object({ storyId: t.String() }),
    body: t.Object({ reason: t.String() }),
    response: { 201: t.Object({ ok: t.Boolean() }) },
    detail: {
      summary: 'Report a story to the administrators',
      description:
        'Sends the reason to the administrators as a message carrying this story id. Only a non-owner may report.',
      tags: ['Story'],
    },
  },
);
