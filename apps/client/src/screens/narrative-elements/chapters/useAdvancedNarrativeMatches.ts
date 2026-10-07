import { useEffect, useMemo, useState } from 'react';
import type { ChapterSelect, ChoiceSelect, SceneSelect } from '../../../db/schema';
import { useDrizzle } from '../../../db';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import type { AdvancedNarrativeMatches } from './createChapterListItemRenderer';

const splitNarrativeCriteria = (criteria: Record<string, unknown>, prefix: string) =>
  Object.fromEntries(
    Object.entries(criteria)
      .filter(([key, value]) => key.startsWith(`${prefix}:`) && value !== undefined && value !== '')
      .map(([key, value]) => [key.slice(prefix.length + 1), value]),
  );

/**
 * What the advanced search finds among chapters, scenes and choices: the ids each scope matched, or
 * `null` while no criterion of any scope is set. The scopes that carry no criterion match everything.
 */
export function useAdvancedNarrativeMatches(input: {
  storyId: string | undefined;
  advancedSearchCriteria: Record<string, unknown>;
  outlineChapters: ChapterSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
}): AdvancedNarrativeMatches | null {
  const { storyId, advancedSearchCriteria, outlineChapters, scenes, choices } = input;
  const db = useDrizzle();
  const [advancedMatches, setAdvancedMatches] = useState<AdvancedNarrativeMatches | null>(null);

  const narrativeCriteria = useMemo(() => {
    const chapterCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'chapter');
    const sceneCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'scene');
    const choiceCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'choice');
    const hasCriteria = [chapterCriteria, sceneCriteria, choiceCriteria].some(
      (criteria) => Object.keys(criteria).length > 0,
    );
    return { chapterCriteria, sceneCriteria, choiceCriteria, hasCriteria };
  }, [advancedSearchCriteria]);

  const [prevStoryId, setPrevStoryId] = useState(storyId);
  const [prevAdvancedSearchCriteria, setPrevAdvancedSearchCriteria] =
    useState(advancedSearchCriteria);
  if (storyId !== prevStoryId || advancedSearchCriteria !== prevAdvancedSearchCriteria) {
    setPrevStoryId(storyId);
    setPrevAdvancedSearchCriteria(advancedSearchCriteria);
    if (!storyId || !narrativeCriteria.hasCriteria) {
      setAdvancedMatches(null);
    }
  }

  useEffect(() => {
    if (!storyId) {
      return;
    }
    const { chapterCriteria, sceneCriteria, choiceCriteria, hasCriteria } = narrativeCriteria;
    if (!hasCriteria) {
      return;
    }

    let cancelled = false;
    const loadAdvancedMatches = async () => {
      const [matchedChapters, matchedScenes, matchedChoices] = await Promise.all([
        Object.keys(chapterCriteria).length
          ? createChapterService(db).getChaptersByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              chapterCriteria,
            )
          : Promise.resolve(outlineChapters),
        Object.keys(sceneCriteria).length
          ? createSceneService(db).getScenesByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              sceneCriteria,
            )
          : Promise.resolve(scenes),
        Object.keys(choiceCriteria).length
          ? createChoiceService(db).getChoicesByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              choiceCriteria,
            )
          : Promise.resolve(choices),
      ]);
      if (!cancelled) {
        setAdvancedMatches({
          chapterIds: new Set(matchedChapters.map((chapter) => chapter.id)),
          sceneIds: new Set(matchedScenes.map((scene) => scene.id)),
          choiceSourceSceneIds: new Set(matchedChoices.map((choice) => choice.sceneId)),
        });
      }
    };
    loadAdvancedMatches();
    return () => {
      cancelled = true;
    };
  }, [narrativeCriteria, choices, db, outlineChapters, scenes, storyId]);

  return advancedMatches;
}
