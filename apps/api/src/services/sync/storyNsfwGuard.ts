import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { storyNsfwService } from '@/services/stories/StoryNsfwService';

/**
 * Why a Story write may not land, or `null` when it may. Flagging a story adults-only is a privilege, not a field: the
 * server may disallow it entirely, and otherwise only age-verified adults may do it. Checked before any write, so a
 * denied flag never lands. Turning the flag off is always allowed, and so is every write that is not about a Story.
 */
export async function storyNsfwRefusal(
  update: { entity: string; type: string },
  userId: string,
): Promise<string | null> {
  if (update.entity !== 'Story') return null;
  const turnsNsfwOn =
    update.type === 'create'
      ? (update as unknown as CreateStoryUpdate).data?.isNsfw === true
      : update.type === 'update' &&
        (update as unknown as UpdateStoryUpdate).changes?.isNsfw === true;
  return turnsNsfwOn ? storyNsfwService.nsfwFlagRefusal(userId) : null;
}
