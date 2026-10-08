import { and, eq, isNull } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import * as schema from '../db/schema';
import type { MenuBadges } from '../navigation/drawerMenuModel';
import { createPublicationService } from '../services/PublicationService';

/**
 * What the story's menu says about its entries without opening them: the history shows the changes still to
 * reach the server (or, louder, the ones the server refused), and Publish and export says the story is out.
 * Read from the device's own records, again whenever `refreshKey` changes (the screen on show, say).
 *
 * Comments carry nothing here: the app does not keep which of them a person has read.
 */
export function useStoryMenuBadges(storyId: string | undefined, refreshKey: string): MenuBadges {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const [badges, setBadges] = useState<{ storyId: string | undefined; value: MenuBadges }>({
    storyId,
    value: {},
  });

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    const read = async () => {
      try {
        const story = await drizzleDb.query.stories.findFirst({
          where: eq(schema.stories.id, storyId),
          columns: { serverId: true },
        });
        const next: MenuBadges = {};
        if (story?.serverId) {
          const [pending, conflicted] = await Promise.all([
            drizzleDb.query.operationLogs.findMany({
              where: and(
                eq(schema.operationLogs.storyId, storyId),
                eq(schema.operationLogs.isSynced, false),
                isNull(schema.operationLogs.conflictState),
              ),
              columns: { id: true },
            }),
            drizzleDb.query.operationLogs.findMany({
              where: and(
                eq(schema.operationLogs.storyId, storyId),
                eq(schema.operationLogs.conflictState, 'conflicted'),
              ),
              columns: { id: true },
            }),
          ]);
          if (conflicted.length > 0) {
            next.OperationLogStack = { kind: 'count', value: conflicted.length, attention: true };
          } else if (pending.length > 0) {
            next.OperationLogStack = { kind: 'count', value: pending.length };
          }
          const published =
            await createPublicationService(drizzleDb).getPublicationsForStory(storyId);
          if (published.length > 0) {
            next.StoryShare = { kind: 'text', value: t('story_share_badge_published') };
          }
        }
        if (!cancelled) setBadges({ storyId, value: next });
      } catch (error) {
        // The menu is usable without its badges.
        console.log('useStoryMenuBadges: could not read the badges.', error);
      }
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, [drizzleDb, refreshKey, storyId, t]);

  return badges.storyId === storyId ? badges.value : {};
}
