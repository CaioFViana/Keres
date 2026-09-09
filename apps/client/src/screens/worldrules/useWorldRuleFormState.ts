import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { WorldRuleService } from '../../services/storymanagement/WorldRuleService';

type UseWorldRuleFormStateOptions = {
  initialWorldRuleId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  worldRuleServiceRef: RefObject<WorldRuleService | null>;
  customFields: StorySchemaField[];
};

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

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              initialWorldRuleId,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
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
  };
}

export type WorldRuleFormState = ReturnType<typeof useWorldRuleFormState>;
