import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { WorldRuleService } from '../../services/storymanagement/WorldRuleService';

type UseWorldRuleFormStateOptions = {
  initialWorldRuleId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  worldRuleServiceRef: RefObject<WorldRuleService | null>;
  customFields: StorySchemaField[];
};

export type WorldRuleFormDraftFields = {
  title: string;
  description: string | null;
  section: WorldPieceSection;
  type: string | null;
  category: string | null;
  behavior: string | null;
  usability: string | null;
  danger: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: WorldRuleFormDraftFields = {
  title: '',
  description: null,
  section: 'rule',
  type: null,
  category: null,
  behavior: null,
  usability: null,
  danger: null,
  isFavorite: false,
  extraNotes: null,
};

function isWorldRuleFormDraftFields(value: unknown): value is WorldRuleFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.title === 'string' &&
    (fields.description === null || typeof fields.description === 'string') &&
    typeof fields.section === 'string' &&
    (fields.type === null || typeof fields.type === 'string') &&
    (fields.category === null || typeof fields.category === 'string') &&
    (fields.behavior === null || typeof fields.behavior === 'string') &&
    (fields.usability === null || typeof fields.usability === 'string') &&
    (fields.danger === null || typeof fields.danger === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

/** Owns field state, initial world-rule hydration and defaults for a WorldRule form. */
export function useWorldRuleFormState({
  initialWorldRuleId,
  storyId,
  drizzleDb,
  worldRuleServiceRef,
  customFields,
}: UseWorldRuleFormStateOptions) {
  const [currentWorldRuleId, setCurrentWorldRuleId] = useState<string | undefined>(
    initialWorldRuleId,
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [section, setSection] = useState<WorldPieceSection>('rule');
  const [type, setType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [behavior, setBehavior] = useState<string | null>(null);
  const [usability, setUsability] = useState<string | null>(null);
  const [danger, setDanger] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<WorldRuleFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentWorldRuleId;
  const retainPersistedWorldRuleId = useCallback((worldRuleId: string) => {
    setCurrentWorldRuleId(worldRuleId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!worldRuleServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialWorldRuleId) {
          const fetchedWorldRule = await worldRuleServiceRef.current.getById(initialWorldRuleId);
          if (fetchedWorldRule) {
            setTitle(fetchedWorldRule.title);
            setDescription(fetchedWorldRule.description);
            setSection(fetchedWorldRule.section as WorldPieceSection);
            setType(fetchedWorldRule.type);
            setCategory(fetchedWorldRule.category);
            setBehavior(fetchedWorldRule.behavior);
            setUsability(fetchedWorldRule.usability);
            setDanger(fetchedWorldRule.danger);
            setIsFavorite(fetchedWorldRule.isFavorite);
            setExtraNotes(fetchedWorldRule.extraNotes);
            setLoadedPristine({
              title: fetchedWorldRule.title,
              description: fetchedWorldRule.description,
              section: fetchedWorldRule.section as WorldPieceSection,
              type: fetchedWorldRule.type,
              category: fetchedWorldRule.category,
              behavior: fetchedWorldRule.behavior,
              usability: fetchedWorldRule.usability,
              danger: fetchedWorldRule.danger,
              isFavorite: fetchedWorldRule.isFavorite,
              extraNotes: fetchedWorldRule.extraNotes,
            });
            setLoadedUpdatedAt(fetchedWorldRule.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialWorldRuleId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(
              storyId,
              'WorldRule',
              initialWorldRuleId,
            );
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            console.warn('World rule not found:', initialWorldRuleId);
          }
        }
      } catch (err) {
        console.error('Failed to load world rule:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialWorldRuleId, worldRuleServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback((fields: WorldRuleFormDraftFields) => {
    if (!isWorldRuleFormDraftFields(fields)) {
      console.error('Corrupt world rule form draft ignored.');
      return;
    }
    setTitle(fields.title);
    setDescription(fields.description);
    setSection(fields.section);
    setType(fields.type);
    setCategory(fields.category);
    setBehavior(fields.behavior);
    setUsability(fields.usability);
    setDanger(fields.danger);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<WorldRuleFormDraftFields>({
      storyId,
      entityType: 'WorldRule',
      entityId: initialWorldRuleId,
      enabled: !!storyId && !loading,
      snapshot: {
        title,
        description,
        section,
        type,
        category,
        behavior,
        usability,
        danger,
        isFavorite,
        extraNotes,
      },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialWorldRuleId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({
      title,
      description,
      section,
      type,
      category,
      behavior,
      usability,
      danger,
      isFavorite,
      extraNotes,
    }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setTitle(target.title);
    setDescription(target.description);
    setSection(target.section);
    setType(target.type);
    setCategory(target.category);
    setBehavior(target.behavior);
    setUsability(target.usability);
    setDanger(target.danger);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    currentWorldRuleId,
    retainPersistedWorldRuleId,
    title,
    setTitle,
    description,
    setDescription,
    section,
    setSection,
    type,
    setType,
    category,
    setCategory,
    behavior,
    setBehavior,
    usability,
    setUsability,
    danger,
    setDanger,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type WorldRuleFormState = ReturnType<typeof useWorldRuleFormState>;
