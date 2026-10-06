import {
  describeChoiceAnnotations,
  type CompileStoryReaderInput,
  type FullStoryExportType,
} from '@keres/shared';

/**
 * What the manuscript and the reader compile from: the export's rows in the shapes the pipeline
 * reads, choice requirements and effects put into words by the shared describer the device export
 * also uses (a publication reads exactly like the local file, in English like the manuscript's
 * default labels), and the raw rules the reader plays by.
 */
export function compileInputOf(storyExport: FullStoryExportType): CompileStoryReaderInput {
  const annotations = describeChoiceAnnotations({
    groups: storyExport.choiceCheckGroups ?? [],
    checks: storyExport.choiceChecks ?? [],
    effects: storyExport.effects ?? [],
    sceneNamesById: Object.fromEntries(
      (storyExport.scenes ?? []).map((scene) => [scene.id, scene.name]),
    ),
    itemNamesById: Object.fromEntries(
      (storyExport.items ?? []).map((item) => [item.id, item.name]),
    ),
  });
  const locationsById = new Map((storyExport.locations ?? []).map((row) => [row.id, row]));
  return {
    storyTitle: storyExport.story.title,
    storyType: storyExport.story.type,
    chapters: (storyExport.chapters ?? []).map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      index: chapter.index,
      type: chapter.type,
      arcId: chapter.arcId,
    })),
    scenes: (storyExport.scenes ?? []).map((scene) => ({
      id: scene.id,
      chapterId: scene.chapterId,
      name: scene.name,
      index: scene.index,
      body: scene.body,
      isDeleted: scene.isDeleted,
      isStart: scene.isStart,
      // What a screenplay writes from the scene beyond its text: its heading and its synopsis.
      summary: scene.summary,
      locationName: scene.locationId ? (locationsById.get(scene.locationId)?.name ?? null) : null,
      locationIntExt: scene.locationId
        ? (locationsById.get(scene.locationId)?.intExt ?? null)
        : null,
    })),
    choices: (storyExport.choices ?? []).map((choice) => ({
      id: choice.id,
      sceneId: choice.sceneId,
      nextSceneId: choice.nextSceneId,
      text: choice.text,
      ...annotations.get(choice.id),
    })),
    arcs: (storyExport.storyArcs ?? []).map((arc) => ({ id: arc.id, title: arc.title })),
    rules: {
      groups: storyExport.choiceCheckGroups ?? [],
      checks: storyExport.choiceChecks ?? [],
      effects: storyExport.effects ?? [],
      items: (storyExport.items ?? []).map((item) => ({ id: item.id, name: item.name })),
    },
  };
}
