import type {
  CharacterRelationInsert,
  CharacterSceneInsert,
  PlotInsert,
  PlotSceneInsert,
  RouteInsert,
  RouteStepInsert,
  TagRelationInsert,
} from '../../../db/schema';
import {
  characterRelations,
  characterScenes,
  plotScenes,
  plots,
  routes,
  routeSteps,
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
