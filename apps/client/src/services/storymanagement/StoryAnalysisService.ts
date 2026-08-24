import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type {
  RunStoryAnalysisOptions,
  StoryAnalysisFinding,
  StoryAnalysisInput} from '../../utils/storyAnalysisChecks';
import {
  buildCheapStoryAnalysisFindings,
  buildStoryAnalysisReport
} from '../../utils/storyAnalysisChecks';

export interface StoryAnalysisReport {
  findings: StoryAnalysisFinding[];
  generatedAt: Date;
}

export interface StoryAnalysisService {
  /** Só as checagens baratas (O(entidades)) - segura pra rodar a cada foco/mudança de dados,
   *  ex.: o badge de issues do dashboard. Não inclui alcançabilidade/satisfazibilidade de Choice. */
  analyzeStoryCheap(storyId: string): Promise<StoryAnalysisReport>;
  /** Relatório completo, incluindo alcançabilidade/satisfazibilidade de Choice - caro em
   *  histórias ramificadas grandes, ver `StoryAnalysisScreen`. Só deve rodar sob demanda. */
  analyzeStoryFull(
    storyId: string,
    options?: RunStoryAnalysisOptions,
  ): Promise<StoryAnalysisReport>;
}

/**
 * Busca tudo que as checagens de `storyAnalysisChecks.ts` precisam de uma vez só, na mesma
 * linha do `MainDashboardScreen.fetchCounts` (consultas diretas no schema, sem passar pela
 * camada de serviço por entidade) - é uma leitura agregada de só-contagem/cross-referência,
 * não uma operação de escrita que precise das checagens de cada serviço individual.
 */
export const createStoryAnalysisService = (db: AppDrizzleClient): StoryAnalysisService => {
  const fetchAnalysisInput = async (storyId: string): Promise<StoryAnalysisInput> => {
    const belongsToStory = (table: { storyId: any; isDeleted: any }) =>
      and(eq(table.storyId, storyId), eq(table.isDeleted, false));

    const [
      story,
      characters,
      characterScenes,
      characterRelations,
      locations,
      locationRelations,
      scenes,
      choices,
      choiceCheckGroups,
      choiceChecks,
      effects,
      items,
      itemJourneys,
      tags,
      tagRelations,
      chapters,
      notes,
      worldRules,
      storySchemaFields,
      attributeValues,
    ] = await Promise.all([
      db.query.stories.findFirst({ where: eq(schema.stories.id, storyId) }),
      db
        .select({ id: schema.characters.id, name: schema.characters.name })
        .from(schema.characters)
        .where(belongsToStory(schema.characters)),
      db
        .select({ characterId: schema.characterScenes.characterId })
        .from(schema.characterScenes)
        .where(belongsToStory(schema.characterScenes)),
      db
        .select({
          character1Id: schema.characterRelations.character1Id,
          character2Id: schema.characterRelations.character2Id,
        })
        .from(schema.characterRelations)
        .where(belongsToStory(schema.characterRelations)),
      db
        .select({ id: schema.locations.id, name: schema.locations.name })
        .from(schema.locations)
        .where(belongsToStory(schema.locations)),
      db
        .select({
          locationAId: schema.locationRelations.locationAId,
          locationBId: schema.locationRelations.locationBId,
        })
        .from(schema.locationRelations)
        .where(belongsToStory(schema.locationRelations)),
      db
        .select({
          id: schema.scenes.id,
          name: schema.scenes.name,
          locationId: schema.scenes.locationId,
          isStart: schema.scenes.isStart,
          isFinish: schema.scenes.isFinish,
          chapterId: schema.scenes.chapterId,
          index: schema.scenes.index,
        })
        .from(schema.scenes)
        .where(belongsToStory(schema.scenes)),
      db
        .select({
          id: schema.choices.id,
          sceneId: schema.choices.sceneId,
          nextSceneId: schema.choices.nextSceneId,
          text: schema.choices.text,
        })
        .from(schema.choices)
        .where(belongsToStory(schema.choices)),
      db
        .select({
          id: schema.choiceCheckGroups.id,
          choiceId: schema.choiceCheckGroups.choiceId,
          combinator: schema.choiceCheckGroups.combinator,
        })
        .from(schema.choiceCheckGroups)
        .where(belongsToStory(schema.choiceCheckGroups)),
      db
        .select({
          id: schema.choiceChecks.id,
          groupId: schema.choiceChecks.groupId,
          mode: schema.choiceChecks.mode,
          type: schema.choiceChecks.type,
          sceneId: schema.choiceChecks.sceneId,
          minVisits: schema.choiceChecks.minVisits,
          itemId: schema.choiceChecks.itemId,
          itemPresence: schema.choiceChecks.itemPresence,
          triggerName: schema.choiceChecks.triggerName,
          triggerState: schema.choiceChecks.triggerState,
        })
        .from(schema.choiceChecks)
        .where(belongsToStory(schema.choiceChecks)),
      db
        .select({
          entityType: schema.effects.entityType,
          entityId: schema.effects.entityId,
          effectType: schema.effects.effectType,
          itemId: schema.effects.itemId,
          triggerName: schema.effects.triggerName,
        })
        .from(schema.effects)
        .where(belongsToStory(schema.effects)),
      db
        .select({ id: schema.items.id, name: schema.items.name })
        .from(schema.items)
        .where(belongsToStory(schema.items)),
      db
        .select({ itemId: schema.itemJourneys.itemId })
        .from(schema.itemJourneys)
        .where(belongsToStory(schema.itemJourneys)),
      db
        .select({ id: schema.tags.id, name: schema.tags.name })
        .from(schema.tags)
        .where(belongsToStory(schema.tags)),
      db
        .select({ tagId: schema.tagRelations.tagId })
        .from(schema.tagRelations)
        .where(belongsToStory(schema.tagRelations)),
      db
        .select({ id: schema.chapters.id, name: schema.chapters.name, index: schema.chapters.index })
        .from(schema.chapters)
        .where(belongsToStory(schema.chapters)),
      db
        .select({ id: schema.notes.id, name: schema.notes.title })
        .from(schema.notes)
        .where(belongsToStory(schema.notes)),
      db
        .select({ id: schema.worldRules.id, name: schema.worldRules.title })
        .from(schema.worldRules)
        .where(belongsToStory(schema.worldRules)),
      db
        .select({
          id: schema.storySchemaFields.id,
          entityType: schema.storySchemaFields.entityType,
          name: schema.storySchemaFields.name,
          type: schema.storySchemaFields.type,
          targetEntityType: schema.storySchemaFields.targetEntityType,
          isRequired: schema.storySchemaFields.isRequired,
        })
        .from(schema.storySchemaFields)
        .where(belongsToStory(schema.storySchemaFields)),
      db
        .select({
          fieldId: schema.attributeValues.fieldId,
          entityId: schema.attributeValues.entityId,
          value: schema.attributeValues.value,
        })
        .from(schema.attributeValues)
        .where(belongsToStory(schema.attributeValues)),
    ]);

    if (!story) {
      throw new Error(`Story with ID ${storyId} not found for analysis.`);
    }

    return {
      storyType: story.type,
      characters,
      characterScenes,
      characterRelations,
      locations,
      locationRelations,
      scenes,
      choices,
      choiceCheckGroups,
      choiceChecks,
      effects,
      items,
      itemJourneys,
      tags,
      tagRelations,
      chapters,
      notes,
      worldRules,
      storySchemaFields,
      attributeValues,
    };
  };

  return {
    async analyzeStoryCheap(storyId: string): Promise<StoryAnalysisReport> {
      const input = await fetchAnalysisInput(storyId);
      return { findings: buildCheapStoryAnalysisFindings(input), generatedAt: new Date() };
    },

    async analyzeStoryFull(
      storyId: string,
      options?: RunStoryAnalysisOptions,
    ): Promise<StoryAnalysisReport> {
      const input = await fetchAnalysisInput(storyId);
      const findings = await buildStoryAnalysisReport(input, options);
      return { findings, generatedAt: new Date() };
    },
  };
};
