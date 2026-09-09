import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../../db';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import type { ChapterService } from '../../../services/storymanagement/ChapterService';

type UseChapterFormStateOptions = {
  initialChapterId?: string;
  storyId?: string;
  activeArcId?: string | null;
  drizzleDb: AppDrizzleClient;
  chapterServiceRef: RefObject<ChapterService | null>;
  customFields: StorySchemaField[];
};

/** Owns field state, initial chapter hydration and defaults for a Chapter form. */
export function useChapterFormState({
  initialChapterId,
  storyId,
  activeArcId,
  drizzleDb,
  chapterServiceRef,
  customFields,
}: UseChapterFormStateOptions) {
  const [currentChapterId, setCurrentChapterId] = useState<string | undefined>(initialChapterId);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  // Only chosen at creation; changing it afterwards is a conversion - see `ChapterDetailScreen`.
  const [isEvent, setIsEvent] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [arcId, setArcId] = useState<string | null>(activeArcId ?? null);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentChapterId;
  const retainPersistedChapterId = useCallback((chapterId: string) => {
    setCurrentChapterId(chapterId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!chapterServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialChapterId) {
          const fetchedChapter = await chapterServiceRef.current.getById(initialChapterId);
          if (fetchedChapter) {
            setName(fetchedChapter.name);
            setSummary(fetchedChapter.summary);
            setIsFavorite(fetchedChapter.isFavorite);
            setExtraNotes(fetchedChapter.extraNotes);
            setIsEvent(fetchedChapter.type === 'event');
            setArcId(fetchedChapter.arcId ?? null);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              initialChapterId,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Chapter not found:', initialChapterId);
          }
        }
      } catch (err) {
        console.error('Failed to load chapter:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialChapterId, chapterServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  return {
    currentChapterId,
    retainPersistedChapterId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    isEvent,
    setIsEvent,
    extraNotes,
    setExtraNotes,
    arcId,
    setArcId,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  };
}

export type ChapterFormState = ReturnType<typeof useChapterFormState>;
