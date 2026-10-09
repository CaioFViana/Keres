import { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import type { EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import Button from '@/src/components/common/controls/Button/Button';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import { useTheme } from '../../../../theme';
import {
  activeCriteria,
  isActiveCriterion,
  type AdvancedSearchCriteria,
} from '../../../../utils/advancedSearchCriteria';
import {
  buildSearchFields,
  criterionKey,
  fieldLabelText,
  type AdvancedSearchScope,
} from '../../../../utils/advancedSearchFields';
import { CUSTOM_FIELD_METADATA_PREFIX } from '../../../../utils/customAttributeFieldMetadata';
import AdvancedSearchFieldRow, { isRenderableField } from './AdvancedSearchFieldRow';

export type { AdvancedSearchScope } from '../../../../utils/advancedSearchFields';

interface AdvancedSearchModalProps {
  entityName: string;
  isVisible: boolean;
  onClose: () => void;
  onSearch: (criteria: AdvancedSearchCriteria) => void;
  storyId: string;
  initialCriteria?: AdvancedSearchCriteria;
  scopes?: AdvancedSearchScope[];
  /**
   * Native fields (by name, unprefixed) the list already filters another way and that are left out of
   * "Add filter". One that still carries a value from before stays, so it can be removed.
   */
  excludeFields?: string[];
  /**
   * How many rows the list would show with these field filters. Given, the dialog shows it on the apply
   * button while the filters are being set - the answer before pressing, not after.
   */
  previewCount?: (criteria: AdvancedSearchCriteria) => Promise<number>;
}

const NO_CRITERIA: AdvancedSearchCriteria = {};
const NO_FIELDS: string[] = [];
const PREVIEW_DELAY_MS = 200;

const FIELD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  boolean: 'toggle-outline',
  number: 'keypad-outline',
  date: 'calendar-outline',
  story_date: 'calendar-outline',
  color: 'color-palette-outline',
  entity: 'link-outline',
};

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  entityName,
  isVisible,
  onClose,
  onSearch,
  storyId,
  initialCriteria = NO_CRITERIA,
  scopes,
  excludeFields = NO_FIELDS,
  previewCount,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [searchCriteria, setSearchCriteria] = useState<AdvancedSearchCriteria>(initialCriteria);

  const effectiveScopes = useMemo<AdvancedSearchScope[]>(
    () => scopes ?? [{ entityName: entityName as StorySchemaEntityType, prefix: '', label: '' }],
    [entityName, scopes],
  );

  // The draft starts over from what is applied: when the criteria are replaced from outside, and
  // each time the modal opens (what was typed and never applied is not kept).
  const [prevInitialCriteria, setPrevInitialCriteria] = useState(initialCriteria);
  const [prevVisible, setPrevVisible] = useState(isVisible);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  if (initialCriteria !== prevInitialCriteria || (isVisible && !prevVisible)) {
    setPrevInitialCriteria(initialCriteria);
    setSearchCriteria(initialCriteria);
  }
  if (isVisible !== prevVisible) {
    setPrevVisible(isVisible);
    // The number belongs to the last time it was asked; opening again does not show it as current.
    if (isVisible) setMatchCount(null);
  }

  // The count follows the draft, a moment after it stops changing. A newer answer replaces an older one;
  // a failed count is simply not shown - it is a nicety, not part of applying.
  const draft = useMemo(() => activeCriteria(searchCriteria), [searchCriteria]);
  useEffect(() => {
    if (!isVisible || !previewCount) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewCount(draft).then(
        (count) => {
          if (!cancelled) setMatchCount(count);
        },
        () => {
          if (!cancelled) setMatchCount(null);
        },
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, isVisible, previewCount]);

  const handleInputChange = useCallback((fieldName: string, value: any) => {
    setSearchCriteria((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  const handleReset = useCallback(() => setSearchCriteria({}), []);

  const handleSubmit = useCallback(() => {
    onSearch(activeCriteria(searchCriteria));
    onClose();
  }, [onSearch, searchCriteria, onClose]);

  return (
    <ResponsiveModal
      visible={isVisible}
      onClose={onClose}
      contentStyle={[
        styles.modalContent,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      maxHeight="86%"
    >
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {t('advanced_search_title')}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {effectiveScopes.map((scope) => (
          <AdvancedSearchScopeFields
            key={`${scope.entityName}:${scope.prefix}`}
            scope={scope}
            storyId={storyId}
            showLabel={effectiveScopes.length > 1}
            criteria={searchCriteria}
            excludeFields={excludeFields}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        ))}
      </ScrollView>
      <View style={styles.modalFooter}>
        <View style={styles.buttonWrapper}>
          <Button
            onPress={handleReset}
            testID="advanced-reset"
            style={{ backgroundColor: colors.textSecondary }}
          >
            {t('advanced_search_reset')}
          </Button>
        </View>
        <View style={styles.buttonWrapper}>
          <Button
            onPress={handleSubmit}
            testID="advanced-apply"
            style={{ backgroundColor: colors.primary }}
          >
            {matchCount === null
              ? t('advanced_search_apply')
              : t('advanced_search_apply_count', { count: matchCount })}
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

interface AdvancedSearchScopeFieldsProps {
  scope: AdvancedSearchScope;
  storyId: string;
  showLabel: boolean;
  criteria: AdvancedSearchCriteria;
  excludeFields: string[];
  onChange: (key: string, value: any) => void;
  onSubmit: () => void;
}

/**
 * One scope's filters: the fields in use as rows, and "Add filter" for the rest. A character has more
 * than twenty searchable fields, so listing them all would bury the one or two a person wants; the
 * name starts open and every other field is one tap away.
 */
const AdvancedSearchScopeFields: React.FC<AdvancedSearchScopeFieldsProps> = ({
  scope,
  storyId,
  showLabel,
  criteria,
  excludeFields,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const customFields = useStorySchemaFields(storyId, scope.entityName as StorySchemaEntityType);
  const fields = useMemo(
    () =>
      buildSearchFields(scope.entityName, customFields)
        .filter(isRenderableField)
        .map((field) => ({ field, key: criterionKey(scope, field) })),
    [customFields, scope],
  );
  const selectable = (field: EntityFieldMetadata) => !excludeFields.includes(field.name);

  // Fields open in this scope: the first native one, whatever already carries a value, whatever was added.
  const [shown, setShown] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const first = buildSearchFields(scope.entityName, [])
      .filter(isRenderableField)
      .find((field) => selectable(field));
    if (first) initial.add(criterionKey(scope, first));
    for (const key of Object.keys(activeCriteria(criteria))) initial.add(key);
    return initial;
  });
  const [menuOpen, setMenuOpen] = useState(false);

  // A value that arrives from outside (restored criteria) opens its row.
  const unseen = fields.filter(({ key }) => isActiveCriterion(criteria[key]) && !shown.has(key));
  if (unseen.length > 0) setShown(new Set([...shown, ...unseen.map(({ key }) => key)]));

  const rows = fields.filter(
    ({ field, key }) => shown.has(key) && (selectable(field) || isActiveCriterion(criteria[key])),
  );
  const addable = fields.filter(({ field, key }) => !shown.has(key) && selectable(field));
  const nativeAddable = addable.filter(
    ({ field }) => !field.name.startsWith(CUSTOM_FIELD_METADATA_PREFIX),
  );
  const customAddable = addable.filter(({ field }) =>
    field.name.startsWith(CUSTOM_FIELD_METADATA_PREFIX),
  );
  const suffix = scope.prefix ? `-${scope.prefix}` : '';

  const addField = (key: string) => {
    setShown(new Set([...shown, key]));
    setMenuOpen(false);
  };
  const removeField = (key: string) => {
    onChange(key, undefined);
    const next = new Set(shown);
    next.delete(key);
    setShown(next);
  };

  const renderOption = ({ field, key }: { field: EntityFieldMetadata; key: string }) => (
    <TouchableOpacity
      key={key}
      onPress={() => addField(key)}
      style={styles.option}
      accessibilityRole="button"
      testID={`advanced-add-option-${key}`}
    >
      <Ionicons
        name={FIELD_ICONS[field.type] ?? 'text-outline'}
        size={18}
        color={colors.textSecondary}
      />
      <Text style={[styles.optionText, { color: colors.text }]}>{fieldLabelText(field, t)}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      {showLabel && <Text style={[styles.scopeTitle, { color: colors.text }]}>{scope.label}</Text>}
      {rows.length === 0 ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('advanced_search_empty')}
        </Text>
      ) : null}
      {rows.map(({ field, key }) => (
        <AdvancedSearchFieldRow
          key={key}
          field={field}
          name={key}
          label={fieldLabelText(field, t)}
          value={criteria[key]}
          storyId={storyId}
          onChange={(value) => onChange(key, value)}
          onRemove={() => removeField(key)}
          onSubmit={onSubmit}
        />
      ))}
      {addable.length > 0 ? (
        <>
          <TouchableOpacity
            onPress={() => setMenuOpen(!menuOpen)}
            style={[styles.addButton, { borderColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: menuOpen }}
            testID={`advanced-add-filter${suffix}`}
          >
            <Ionicons name={menuOpen ? 'chevron-up' : 'add'} size={20} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>
              {t('advanced_search_add')}
            </Text>
          </TouchableOpacity>
          {menuOpen ? (
            <View style={[styles.menu, { borderColor: colors.border }]}>
              {nativeAddable.map(renderOption)}
              {customAddable.length > 0 ? (
                <Text style={[styles.menuHeading, { color: colors.textSecondary }]}>
                  {t('advanced_search_custom_section')}
                </Text>
              ) : null}
              {customAddable.map(renderOption)}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    // ResponsiveModal normally clips to preserve rounded media/modal surfaces.
    // Advanced-search controls draw their focus treatment at the edge, so this
    // particular form must let that treatment extend into its own padding.
    overflow: 'visible',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flexGrow: 1,
    marginBottom: 16,
  },
  // Keeps an input's themed focus border inside the scrollable clipping area.
  scrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  scopeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 5,
    marginBottom: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  menu: {
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 4,
    marginBottom: 14,
  },
  menuHeading: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: '3%',
  },
  buttonWrapper: {
    width: '47%',
  },
});

export default AdvancedSearchModal;
