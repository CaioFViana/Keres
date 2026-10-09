import { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import type { EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEntityPickerOptions } from '@/src/hooks/useEntityPickerOptions';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import { useTheme } from '../../../../theme';
import {
  activeCriteria,
  type AdvancedSearchCriteria,
} from '../../../../utils/advancedSearchCriteria';
import {
  buildSearchFields,
  criterionKey,
  fieldLabelText,
  type AdvancedSearchScope,
} from '../../../../utils/advancedSearchFields';
import type { FavoriteFilterState } from '../../../../types/entityFilters';

interface ActiveFilterChipsProps {
  storyId?: string;
  entityName?: string;
  scopes?: AdvancedSearchScope[];
  criteria: AdvancedSearchCriteria | undefined;
  favoriteState: FavoriteFilterState;
  onClearFavorite: () => void;
  onRemoveCriterion: (key: string) => void;
  onClearAll: () => void;
}

interface ChipProps {
  label: string;
  onRemove: () => void;
  removeLabel: string;
  testID: string;
  color?: string;
  /** Replaces the plain value text (an entity's name, resolved after the chip is drawn). */
  children?: React.ReactNode;
}

const Chip: React.FC<ChipProps> = ({ label, onRemove, removeLabel, testID, color, children }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.chip, { backgroundColor: colors.primaryContainer }]}
      testID={testID}
      accessibilityLabel={label}
    >
      {color ? (
        <View style={[styles.swatch, { backgroundColor: color, borderColor: colors.border }]} />
      ) : null}
      <Text style={[styles.chipText, { color: colors.onPrimaryContainer }]} numberOfLines={1}>
        {children ?? label}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        testID={`${testID}-remove`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={colors.onPrimaryContainer} />
      </TouchableOpacity>
    </View>
  );
};

/** An entity reference is stored as an id; the chip shows the entity's name. */
const EntityReferenceText: React.FC<{
  storyId: string;
  entityType: StorySchemaEntityType;
  id: string;
  prefix: string;
}> = ({ storyId, entityType, id, prefix }) => {
  const { t } = useTranslation();
  const { options } = useEntityPickerOptions(storyId, entityType);
  const name = options.find((option) => option.id === id)?.name;
  return (
    <>
      {prefix}: {name || t('unnamed')}
    </>
  );
};

/** The chips of one scope: its fields that carry a value in the criteria. */
const ScopeCriteriaChips: React.FC<{
  scope: AdvancedSearchScope;
  storyId: string;
  criteria: AdvancedSearchCriteria;
  showScope: boolean;
  onRemoveCriterion: (key: string) => void;
}> = ({ scope, storyId, criteria, showScope, onRemoveCriterion }) => {
  const { t } = useTranslation();
  const customFields = useStorySchemaFields(storyId, scope.entityName as StorySchemaEntityType);
  const fields = useMemo(
    () => buildSearchFields(scope.entityName, customFields),
    [customFields, scope.entityName],
  );

  const entries = fields
    .map((field: EntityFieldMetadata) => ({ field, key: criterionKey(scope, field) }))
    .filter(({ key }) => key in criteria);

  return (
    <>
      {entries.map(({ field, key }) => {
        const value = criteria[key];
        const baseLabel = fieldLabelText(field, t);
        const label = showScope ? `${scope.label} · ${baseLabel}` : baseLabel;
        const valueText =
          typeof value === 'boolean' ? (value ? t('common_yes') : t('common_no')) : String(value);
        return (
          <Chip
            key={key}
            testID={`filter-chip-${key}`}
            label={`${label}: ${valueText}`}
            removeLabel={t('list_remove_filter', { filter: label })}
            color={field.type === 'color' ? String(value) : undefined}
            onRemove={() => onRemoveCriterion(key)}
          >
            {field.type === 'entity' && field.entityTargetType ? (
              <EntityReferenceText
                storyId={storyId}
                entityType={field.entityTargetType as StorySchemaEntityType}
                id={String(value)}
                prefix={label}
              />
            ) : undefined}
          </Chip>
        );
      })}
    </>
  );
};

/**
 * What narrows the list besides the words in the search box: the favorites view and each field
 * filter, one chip apiece with its own remove button. Without this a filter set an hour ago - or
 * restored from the last visit - leaves a short list and no sign of why.
 */
const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  storyId,
  entityName,
  scopes,
  criteria,
  favoriteState,
  onClearFavorite,
  onRemoveCriterion,
  onClearAll,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const active = useMemo(() => activeCriteria(criteria), [criteria]);
  const effectiveScopes = useMemo<AdvancedSearchScope[]>(
    () => scopes ?? (entityName ? [{ entityName, prefix: '', label: '' }] : []),
    [entityName, scopes],
  );

  const criteriaCount = storyId && entityName ? Object.keys(active).length : 0;
  const favoriteCount = favoriteState === 'all' ? 0 : 1;
  const total = criteriaCount + favoriteCount;
  if (total === 0) return null;

  return (
    <View style={styles.row} testID="active-filter-chips">
      <View style={styles.chips}>
        {favoriteCount > 0 ? (
          <Chip
            testID="filter-chip-favorite"
            label={
              favoriteState === 'favorite' ? t('list_favorites_only') : t('list_favorites_not')
            }
            removeLabel={t('list_remove_filter', {
              filter:
                favoriteState === 'favorite' ? t('list_favorites_only') : t('list_favorites_not'),
            })}
            onRemove={onClearFavorite}
          />
        ) : null}
        {criteriaCount > 0 && storyId
          ? effectiveScopes.map((scope) => (
              <ScopeCriteriaChips
                key={`${scope.entityName}:${scope.prefix}`}
                scope={scope}
                storyId={storyId}
                criteria={active}
                showScope={effectiveScopes.length > 1}
                onRemoveCriterion={onRemoveCriterion}
              />
            ))
          : null}
        {/* Also with a single field chip: a criterion on a field that no longer exists has none. */}
        {criteriaCount > 0 || total > 1 ? (
          <TouchableOpacity
            onPress={onClearAll}
            accessibilityRole="button"
            testID="filter-chips-clear-all"
            style={styles.clearAll}
          >
            <Text style={[styles.clearAllText, { color: colors.primary }]}>
              {t('list_clear_filters')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 260,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearAll: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ActiveFilterChips;
