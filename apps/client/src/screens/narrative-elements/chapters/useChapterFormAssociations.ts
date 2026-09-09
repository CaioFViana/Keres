import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { AppDrizzleClient } from '../../../db';
import type { StoryArcSelect } from '../../../db/schema';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { createStoryArcService } from '../../../services/storymanagement/StoryArcService';

type UseChapterFormAssociationsOptions = {
  currentChapterId: string | undefined;
  isEditing: boolean;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  setArcId: Dispatch<SetStateAction<string | null>>;
};

/** Owns tag/note relations and story-arc lookup used by the Chapter form. */
export function useChapterFormAssociations({
  currentChapterId,
  isEditing,
  storyId,
  drizzleDb,
  setArcId,
}: UseChapterFormAssociationsOptions) {
  const [arcs, setArcs] = useState<StoryArcSelect[]>([]);

  const relations = useEntityRelations({
    entityType: 'Chapter',
    entityId: currentChapterId,
    preserveDraftOnEntityCreation: true,
  });

  useEffect(() => {
    if (!storyId) return;
    void createStoryArcService(drizzleDb)
      .getArcsForStory(storyId)
      .then((loaded) => {
        setArcs(loaded);
        if (!isEditing) {
          setArcId(
            (current) =>
              current ?? loaded.find((arc) => arc.isDefault)?.id ?? loaded[0]?.id ?? null,
          );
        }
      });
  }, [drizzleDb, isEditing, setArcId, storyId]);

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations],
  );

  return {
    ...relations,
    chapterNoteRelations: relations.noteRelations,
    handleTagSelectionChange,
    arcs,
  };
}
