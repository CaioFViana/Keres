import type { SeeAlsoManagerHandle } from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  type CalendarDefinitionType,
  parseCalendarDateCoordinate,
  type Scene,
  type StorySchemaField,
} from '@keres/shared';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '@/src/db';
import { useEntityFormActions } from '@/src/hooks/forms/useEntityFormActions';
import type { NarrativeElementsStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import type { SceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { coordinateExists } from '@/src/utils/calendar/calendarDateFields';
import { parseTimingInput } from '@/src/utils/scene/sceneTimingInput';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import type { SceneFormState } from './useSceneFormState';

type SceneNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'SceneForm'>;

// `body` is deliberately excluded: the manuscript is owned by the scene Editor, and a form save
// must never touch (let alone null out) prose it cannot see.
export type SceneFormData = Omit<
  Scene,
  | 'id'
  | 'storyId'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
  | 'isDeleted'
  | 'deletedAt'
  | 'index'
  | 'rank'
  | 'body'
>;

type UseSceneFormActionsOptions = {
  state: SceneFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  sceneServiceRef: RefObject<SceneService | null>;
  navigation: SceneNavigation;
  /** The story's calendars: a fixed date is checked against the one it is written in. */
  calendars?: { id: string; definition: CalendarDefinitionType }[];
  storyId?: string;
  userId?: string | null;
  persistTagRelations(sceneId: string): Promise<void>;
  persistNoteRelations(sceneId: string): Promise<void>;
  persistCharacterRelations(sceneId: string): Promise<void>;
  persistSecondaryDraft?(sceneId: string): Promise<void>;
  clearSecondaryDraft?(sceneId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Scene form. */
export function useSceneFormActions({
  state,
  customFields,
  drizzleDb,
  sceneServiceRef,
  navigation,
  calendars = [],
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistCharacterRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseSceneFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Scene');
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  /**
   * Syntax first, then that the date exists in its calendar: the form's fields only offer real dates,
   * but a calendar edited since (a month shortened, one removed) can leave a saved date that no longer is.
   * A calendar that is not loaded cannot be checked against, and is not guessed at.
   */
  const fixedDateError = (calendarDateOverride: string) => {
    if (!calendarDateOverride) return null;
    const coordinate = parseCalendarDateCoordinate(calendarDateOverride);
    if (!coordinate) return t('scene_fixed_date_invalid');
    const calendarId = state.calendarDateOverrideCalendarId;
    const calendar = calendarId ? calendars.find((candidate) => candidate.id === calendarId) : null;
    if (calendarId && !calendar) return null;
    return coordinateExists(calendar?.definition ?? null, coordinate)
      ? null
      : t('scene_fixed_date_out_of_range');
  };

  /** The timing the author typed, or the message that says what is wrong with it. */
  const readTiming = () => {
    const gap = parseTimingInput(state.gapInput);
    const duration = parseTimingInput(state.durationInput);
    const calendarDateOverride = state.calendarDateOverride.trim();
    const error =
      (state.gapInput !== '' && gap === null) || (state.durationInput !== '' && duration === null)
        ? t('scene_timing_invalid')
        : fixedDateError(calendarDateOverride);
    return { gap, duration, calendarDateOverride, error };
  };

  const actions = useEntityFormActions<SceneFormData, { id: string }>({
    entityType: 'Scene',
    changeEvent: 'scene_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentSceneId,
    isServiceReady: () => !!sceneServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedSceneId,
    validate: () => (state.name.trim() ? readTiming().error : t('name_required')),
    buildData: () => {
      const { gap, duration, calendarDateOverride } = readTiming();
      return {
        chapterId: state.chapterId,
        locationId: state.locationId,
        name: state.name.trim(),
        summary: state.summary,
        isFavorite: state.isFavorite,
        extraNotes: state.extraNotes,
        gap,
        gapType: state.gapType,
        calendarDateOverride: calendarDateOverride || null,
        calendarDateOverrideCalendarId: calendarDateOverride
          ? state.calendarDateOverrideCalendarId
          : null,
        duration,
        durationType: state.durationType,
        isStart: state.isStart,
        isFinish: state.isFinish,
      };
    },
    create: (user, story, data) =>
      sceneServiceRef.current!.createScene(user, { ...data, storyId: story }),
    update: async (user, sceneId, data) => {
      const service = sceneServiceRef.current!;
      if (!(await service.getById(sceneId))) throw new Error(copy.notFound);
      return service.updateScene(user, sceneId, data);
    },
    remove: (user, sceneId) => sceneServiceRef.current!.deleteScene(user, sceneId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      async (sceneId) => seeAlsoManagerRef.current?.persistPending(sceneId),
      persistCharacterRelations,
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_scene_title',
      title: copy.deleteLabel,
      messageKey: 'delete_scene_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_scene',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (sceneId, created) => {
      if (created) navigation.dispatch(StackActions.replace('SceneForm', { sceneId }));
      else navigation.goBack();
    },
    afterDelete: () => navigation.goBack(),
    logName: 'scene',
  });

  return { ...actions, seeAlsoManagerRef };
}
