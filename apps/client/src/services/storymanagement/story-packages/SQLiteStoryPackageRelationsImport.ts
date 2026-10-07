import type {
  CharacterRelationInsert,
  CharacterSceneInsert,
  PlotInsert,
  PlotSceneInsert,
  RouteInsert,
  RouteStepInsert,
  SceneMusicInsert,
  ScenePageInsert,
  SongInsert,
  TagRelationInsert,
} from '../../../db/schema';
import {
  characterRelations,
  characterScenes,
  plotScenes,
  plots,
  routes,
  routeSteps,
  sceneMusic,
  scenePages,
  songs,
  tagRelations,
} from '../../../db/schema';
import type { SQLiteStoryPackageImportContext } from './SQLiteStoryPackageImportContext';

/**
 * Writes relationship and narrative-structure collections after their participants already exist:
 * character links, plots, routes and tag assignments. It participates in the caller's transaction.
 */
export async function importStoryPackageRelations(
  context: SQLiteStoryPackageImportContext,
): Promise<void> {
  const { fullStory, tx } = context;

  for (const relation of fullStory.characterRelations) {
    const row: CharacterRelationInsert = {
      ...relation,
      storyId: relation.storyId,
      createdAt: new Date(relation.createdAt),
      updatedAt: new Date(),
      version: relation.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(characterRelations).values(row).run();
  }

  for (const relation of fullStory.characterScenes) {
    const row: CharacterSceneInsert = {
      ...relation,
      storyId: relation.storyId,
      characterId: relation.characterId,
      sceneId: relation.sceneId,
      createdAt: new Date(relation.createdAt),
      updatedAt: new Date(),
      version: relation.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(characterScenes).values(row).run();
  }

  for (const plot of fullStory.plots ?? []) {
    const row: PlotInsert = {
      ...plot,
      createdAt: new Date(plot.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(plots).values(row).run();
  }

  for (const plotScene of fullStory.plotScenes ?? []) {
    const row: PlotSceneInsert = {
      ...plotScene,
      createdAt: new Date(plotScene.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(plotScenes).values(row).run();
  }

  // A route must precede its ordered visits.
  for (const route of fullStory.routes ?? []) {
    const row: RouteInsert = {
      ...route,
      createdAt: new Date(route.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(routes).values(row).run();
  }
  for (const step of fullStory.routeSteps ?? []) {
    const row: RouteStepInsert = {
      ...step,
      createdAt: new Date(step.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(routeSteps).values(row).run();
  }
  // A song stands alone; the ids are the package's own here, and the music that sings it follows them.
  for (const song of fullStory.songs ?? []) {
    const row: SongInsert = {
      ...song,
      createdAt: new Date(song.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(songs).values(row).run();
  }
  // A page keeps its text even when its image is not in the package; the ids are the package's own here.
  for (const page of fullStory.scenePages ?? []) {
    const row: ScenePageInsert = {
      ...page,
      createdAt: new Date(page.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(scenePages).values(row).run();
  }
  // Music keeps its cue even when its target is not in the package; the ids are the package's own here.
  for (const music of fullStory.sceneMusic ?? []) {
    const row: SceneMusicInsert = {
      ...music,
      createdAt: new Date(music.createdAt),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(sceneMusic).values(row).run();
  }

  for (const relation of fullStory.tagRelations ?? []) {
    const row: TagRelationInsert = {
      ...relation,
      storyId: relation.storyId,
      tagId: relation.tagId,
      relationId: relation.relationId,
      relationType: relation.relationType,
      createdAt: new Date(relation.createdAt),
      updatedAt: new Date(),
      version: relation.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(tagRelations).values(row).run();
  }
}
