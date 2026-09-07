import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient, SceneSelect } from '../../../db';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import type { SceneService } from '../../../services/storymanagement/SceneService';
import type { StorySchemaField } from '@keres/shared';

type UseSceneFormStateOptions = {
  initialSceneId?: string;
  initialChapterId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  sceneServiceRef: RefObject<SceneService | null>;
  customFields: StorySchemaField[];
};

/** Owns field state, initial scene hydration and defaults for a Scene form. */
export function useSceneFormState({
  initialSceneId,
  initialChapterId,
  storyId,
  drizzleDb,
  sceneServiceRef,
  customFields,
}: UseSceneFormStateOptions) {
  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [gapInput, setGapInput] = useState('');
  const [gapType, setGapType] = useState<string | null>(null);
  const [calendarDateOverride, setCalendarDateOverride] = useState('');
  const [calendarDateOverrideCalendarId, setCalendarDateOverrideCalendarId] = useState<
    string | null
  >(null);
  const [durationInput, setDurationInput] = useState('');
  const [durationType, setDurationType] = useState<string | null>(null);
  const [isStart, setIsStart] = useState(false);
  const [isFinish, setIsFinish] = useState(false);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentSceneId;

  useEffect(() => {
    const applyScene = (scene: SceneSelect) => {
      setChapterId(scene.chapterId);
      setLocationId(scene.locationId);
      setName(scene.name);
      setSummary(scene.summary);
      setIsFavorite(scene.isFavorite);
      setExtraNotes(scene.extraNotes);
      setGapInput(scene.gap === null ? '' : String(scene.gap));
      setGapType(scene.gapType);
      setCalendarDateOverride(scene.calendarDateOverride ?? '');
      setCalendarDateOverrideCalendarId(scene.calendarDateOverrideCalendarId);
      setDurationInput(scene.duration === null ? '' : String(scene.duration));
      setDurationType(scene.durationType);
      setIsStart(scene.isStart);
      setIsFinish(scene.isFinish);
    };

    const load = async () => {
      if (!sceneServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (currentSceneId) {
          const scene = await sceneServiceRef.current.getById(currentSceneId);
          if (scene) {
            applyScene(scene);
            const values = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentSceneId,
            );
            setCustomValues(Object.fromEntries(values.map((value) => [value.fieldId, value.value])));
          }
        } else if (initialChapterId) {
          setChapterId(initialChapterId);
        }
      } catch (error) {
        console.error('Failed to load scene:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [
    currentSceneId,
    drizzleDb,
    initialChapterId,
    sceneServiceRef,
    storyId,
  ]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  return {
    currentSceneId,
    setCurrentSceneId,
    chapterId,
    setChapterId,
    locationId,
    setLocationId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    gapInput,
    setGapInput,
    gapType,
    setGapType,
    calendarDateOverride,
    setCalendarDateOverride,
    calendarDateOverrideCalendarId,
    setCalendarDateOverrideCalendarId,
    durationInput,
    setDurationInput,
    durationType,
    setDurationType,
    isStart,
    setIsStart,
    isFinish,
    setIsFinish,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  };
}

export type SceneFormState = ReturnType<typeof useSceneFormState>;
