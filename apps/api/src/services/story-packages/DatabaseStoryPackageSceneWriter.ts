import { scenesToUnflag } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';

/**
 * Scene-specific persistence rule deliberately kept outside the generic collection repository.
 * After a linear import, it enforces the one-start and one-finish invariant with shared client logic.
 */
export async function normalizeImportedLinearSceneFlags(
  context: DatabaseStoryPackageImportContext,
): Promise<void> {
  if (context.fullStory.story.type !== 'linear') return;
  const importedScenes = (await context.tx.query.scenes.findMany({
    where: eq(schema.scenes.storyId, context.targetStoryId),
    columns: { id: true, isStart: true, isFinish: true, version: true },
  })) as Array<{ id: string; isStart: boolean; isFinish: boolean; version: number }>;
  const unflag = scenesToUnflag(importedScenes);
  const versionOf = new Map(importedScenes.map((scene) => [scene.id, scene.version]));

  for (const sceneId of unflag.start) {
    await context.tx
      .update(schema.scenes)
      .set({
        isStart: false,
        updatedAt: context.now,
        version: (versionOf.get(sceneId) ?? 0) + 1,
      })
      .where(eq(schema.scenes.id, sceneId));
  }
  for (const sceneId of unflag.finish) {
    await context.tx
      .update(schema.scenes)
      .set({
        isFinish: false,
        updatedAt: context.now,
        version: (versionOf.get(sceneId) ?? 0) + 1,
      })
      .where(eq(schema.scenes.id, sceneId));
  }
}
