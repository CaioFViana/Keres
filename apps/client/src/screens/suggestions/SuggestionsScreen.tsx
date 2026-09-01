import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import { isSuggestionAttributeType, STORY_SCHEMA_ENTITY_TYPES } from '@keres/shared';
import { WORLD_PIECE_SECTIONS } from '@keres/shared/entities/WorldRule';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { SuggestionSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createStorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import {
  createSuggestionService,
  customAttributeSuggestionType,
  isNamedListType,
  namedListDisplayKey,
  WORLD_PIECE_CATEGORY_TYPE,
  WORLD_PIECE_TYPE_PREFIX,
} from '../../services/storymanagement/SuggestionService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useDocumentTitle } from '../../utils/documentTitle';
import { isStoryVocabularyEntityType } from '../../vocabulary/resolveStoryTerm';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

type SuggestionGroup = { type: string; label: string; key: string; name?: string };
type StorySuggestion = [value: string, usageCount: number];

const SUGGESTION_SOURCE_EVENTS = [
  'character_changed',
  'character_relation_changed',
  'item_changed',
  'item_journey_changed',
  'worldrule_changed',
  'attribute_value_changed',
] as const;

const ENTITY_LABELS: Record<string, string> = {
  Character: 'characters_title',
  CharacterRelation: 'character_relations_title',
  Item: 'items_title',
  ItemJourney: 'item_journeys_title',
};
const SCHEMA_ENTITY_LABELS: Record<StorySchemaEntityType, string> = {
  Character: 'characters_title',
  Location: 'locations_title',
  Item: 'items_title',
  Scene: 'scenes_title',
  Chapter: 'chapters_title',
  Note: 'notes_title',
  WorldRule: 'world_rules_title',
};

const SuggestionsScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { label } = useStoryVocabulary();
  useDocumentTitle(t('standard_suggestions_title'));
  const { colors } = useTheme();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const navigation = useNavigation<any>();
  const { isCompact } = useResponsiveLayout();
  const db = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const suggestionService = useMemo(() => createSuggestionService(db), [db]);
  const [groups, setGroups] = useState<SuggestionGroup[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [stored, setStored] = useState<SuggestionSelect[]>([]);
  const [storyValues, setStoryValues] = useState<StorySuggestion[]>([]);
  const [usageByValue, setUsageByValue] = useState<Map<string, number>>(new Map());
  const [newValue, setNewValue] = useState('');
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [renamingList, setRenamingList] = useState(false);
  const [renameListName, setRenameListName] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  const loadGroups = useCallback(async () => {
    if (!storyId) return setGroups([]);
    const nativeByType = new Map<
      string,
      { type: string; key: string; entityLabels: string[]; fieldLabels: string[] }
    >();
    Object.entries(entityFieldMetadata).forEach(([entity, fields]) => {
      fields
        .filter((field) => field.isSuggestion && field.suggestionsSource)
        .forEach((field) => {
          const type = field.suggestionsSource!;
          const current = nativeByType.get(type) ?? {
            type,
            key: type,
            entityLabels: [],
            fieldLabels: [],
          };
          const entityLabel = isStoryVocabularyEntityType(entity)
            ? label(entity, true)
            : t(ENTITY_LABELS[entity] ?? entity);
          const fieldLabel = t(field.label);
          if (!current.entityLabels.includes(entityLabel)) current.entityLabels.push(entityLabel);
          if (!current.fieldLabels.includes(fieldLabel)) current.fieldLabels.push(fieldLabel);
          nativeByType.set(type, current);
        });
    });
    const native = Array.from(nativeByType.values()).map((group) => ({
      type: group.type,
      key: group.key,
      label: `${group.entityLabels.join(' + ')} · ${group.fieldLabels.join(' / ')}`,
    }));
    const worldPiece = [
      ...WORLD_PIECE_SECTIONS.map((section) => ({
        type: `${WORLD_PIECE_TYPE_PREFIX}${section}`,
        key: `world_piece_type_${section}`,
        label: `${t(`world_piece_section_${section}`)} · ${t('world_piece_type')}`,
      })),
      {
        type: WORLD_PIECE_CATEGORY_TYPE,
        key: 'world_piece_category',
        label: `${t('world_title')} · ${t('category')}`,
      },
    ];
    const schemaService = createStorySchemaFieldService(db);
    const batches = await Promise.all(
      STORY_SCHEMA_ENTITY_TYPES.map((entityType) =>
        schemaService.getFieldsByStoryAndEntityType(storyId, entityType),
      ),
    );
    const custom = batches.flatMap((fields, index) =>
      fields
        .filter((field) => isSuggestionAttributeType(field.type))
        .map((field) => ({
          type: customAttributeSuggestionType(field.id),
          key: field.key,
          label: `${
            isStoryVocabularyEntityType(STORY_SCHEMA_ENTITY_TYPES[index])
              ? label(STORY_SCHEMA_ENTITY_TYPES[index], true)
              : t(SCHEMA_ENTITY_LABELS[STORY_SCHEMA_ENTITY_TYPES[index]])
          } · ${field.name}`,
        })),
    );
    const named = (await suggestionService.listNamedLists(storyId)).map((list) => ({
      type: list.type,
      key: namedListDisplayKey(list.type),
      name: list.name,
      label: `${t('suggestion_named_list')} · ${list.name}`,
    }));
    const next = [...native, ...worldPiece, ...custom, ...named].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    setGroups(next);
    setSelectedType((current) =>
      current && next.some((group) => group.type === current) ? current : (next[0]?.type ?? null),
    );
  }, [db, label, storyId, suggestionService, t]);

  const loadValues = useCallback(async () => {
    if (!storyId || !selectedType) {
      setStored([]);
      setStoryValues([]);
      setUsageByValue(new Map());
      return;
    }
    const [storedSuggestions, usageCounts] = await Promise.all([
      suggestionService.getStoredSuggestions(selectedType, storyId),
      suggestionService.getSuggestionUsageCounts(selectedType, storyId),
    ]);
    const storedValues = new Set(storedSuggestions.map((suggestion) => suggestion.value));
    setStored(storedSuggestions);
    setUsageByValue(new Map(usageCounts));
    setStoryValues(usageCounts.filter(([value]) => !storedValues.has(value)));
  }, [selectedType, storyId, suggestionService]);

  const selectedGroup = groups.find((group) => group.type === selectedType);
  const copyDestinations = groups.filter((group) => group.type !== selectedType);

  const removeNamedList = useCallback(() => {
    if (!selectedType || !isNamedListType(selectedType)) return;
    AppAlert.alert(t('delete'), t('delete_named_suggestion_list_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (!userId || !storyId) return;
          await suggestionService.deleteNamedList(userId, storyId, selectedType);
          await loadGroups();
        },
      },
    ]);
  }, [loadGroups, selectedType, storyId, suggestionService, t, userId]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('standard_suggestions_title'),
        headerRight: () =>
          canEdit ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15, gap: 15 }}>
              <TouchableOpacity
                onPress={() => {
                  setCreatingList(true);
                  setRenamingList(false);
                  setCopying(false);
                }}
                accessibilityLabel={t('suggestion_new_list')}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
              {selectedType && stored.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCopying(true);
                    setCopyTargets([]);
                  }}
                  accessibilityLabel={t('suggestion_copy_to')}
                >
                  <Ionicons name="copy-outline" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
              {selectedType && isNamedListType(selectedType) && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setRenamingList(true);
                      setRenameListName(selectedGroup?.name ?? '');
                      setCreatingList(false);
                      setCopying(false);
                    }}
                    accessibilityLabel={t('suggestion_rename_list')}
                  >
                    <Ionicons name="pencil-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={removeNamedList}
                    accessibilityLabel={t('suggestion_delete_list')}
                  >
                    <Ionicons name="trash-outline" size={24} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : undefined,
      });
      loadGroups();
      loadValues();
    }, [
      canEdit,
      colors.error,
      colors.text,
      loadGroups,
      loadValues,
      navigation,
      removeNamedList,
      selectedGroup?.name,
      selectedType,
      stored.length,
      t,
    ]),
  );
  useEffect(() => {
    loadValues();
  }, [loadValues]);
  useEffect(() => {
    setRenamingList(false);
    setRenameListName('');
  }, [selectedType]);
  useEffect(() => {
    const refresh = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadValues();
    };
    entityEventEmitter.on('suggestion_changed', refresh);
    SUGGESTION_SOURCE_EVENTS.forEach((event) => entityEventEmitter.on(event, refresh));
    return () => {
      entityEventEmitter.off('suggestion_changed', refresh);
      SUGGESTION_SOURCE_EVENTS.forEach((event) => entityEventEmitter.off(event, refresh));
    };
  }, [loadValues, storyId]);

  const add = async () => {
    if (!userId || !storyId || !selectedType || !newValue.trim()) return;
    try {
      await suggestionService.createSuggestion(userId, selectedType, newValue, storyId);
      setNewValue('');
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };
  const createList = async () => {
    if (!userId || !storyId || !newListName.trim()) return;
    try {
      const created = await suggestionService.createNamedList(userId, storyId, newListName);
      setNewListName('');
      setCreatingList(false);
      await loadGroups();
      setSelectedType(created.type);
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };

  const renameList = async () => {
    if (!userId || !storyId || !selectedType || !renameListName.trim()) return;
    try {
      await suggestionService.renameNamedList(userId, storyId, selectedType, renameListName);
      setRenamingList(false);
      await loadGroups();
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };

  const copyToSelected = async () => {
    if (!userId || !storyId || !selectedType || copyTargets.length === 0) return;
    try {
      const result = await suggestionService.copyStoredValues(
        userId,
        storyId,
        selectedType,
        copyTargets,
      );
      setCopying(false);
      setCopyTargets([]);
      AppAlert.alert(
        t('success'),
        t('suggestion_copy_result', { copied: result.copied, skipped: result.skipped }),
      );
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };

  const toggleCopyTarget = (type: string) => {
    setCopyTargets((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const styles = StyleSheet.create({
    title: { color: colors.text, fontSize: 24, fontWeight: 'bold' },
    description: { color: colors.textSecondary, marginTop: 5, marginBottom: 16 },
    // Compact: a strip of chips with horizontal scrolling (it fits well on narrow screens). Wide: a fixed
    // left-hand column with the complete list of groups, without depending on horizontal scrolling to reach
    // groups "off screen" - the original problem on this screen.
    wideLayout: { flex: 1, flexDirection: 'row', gap: 20 },
    // Vertical scrolling with line wrapping, not horizontal scrolling - in a list with many groups, a chip
    // "off screen" to the side gave no visual clue that there was more to scroll to; with wrapping,
    // everything is reachable just by going down.
    groups: { maxHeight: 160, marginBottom: 16 },
    groupsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text },
    chipTextSelected: { color: colors.onPrimary, fontWeight: '600' },
    groupsColumn: {
      width: 300,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingRight: 16,
    },
    groupListItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
    groupListItemSelected: { backgroundColor: colors.primaryContainer },
    groupListItemText: { color: colors.text },
    groupListItemTextSelected: { color: colors.text, fontWeight: '700' },
    contentColumn: { flex: 1 },
    key: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
    input: { flex: 1, marginBottom: 0, width: undefined },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 58,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    value: { flex: 1, color: colors.text, fontSize: 16 },
    storyValue: { flex: 1, color: colors.textSecondary, fontSize: 16 },
    usage: { color: colors.textSecondary, fontSize: 14, marginRight: 4 },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 2,
      textTransform: 'uppercase',
    },
    icon: { padding: 7 },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 28 },
    copyList: { marginBottom: 12 },
    copyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
    copyLabel: { flex: 1, color: colors.text },
    modalContent: { padding: 16, gap: 12 },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  });

  const groupsList = isCompact ? (
    <ScrollView style={styles.groups}>
      <View style={styles.groupsWrap}>
        {groups.map((group) => (
          <TouchableOpacity
            key={group.type}
            onPress={() => setSelectedType(group.type)}
            style={[styles.chip, selectedType === group.type && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedType === group.type && styles.chipTextSelected]}>
              {group.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  ) : (
    <ScrollView style={styles.groupsColumn}>
      {groups.map((group) => (
        <TouchableOpacity
          key={group.type}
          onPress={() => setSelectedType(group.type)}
          style={[
            styles.groupListItem,
            selectedType === group.type && styles.groupListItemSelected,
          ]}
        >
          <Text
            style={[
              styles.groupListItemText,
              selectedType === group.type && styles.groupListItemTextSelected,
            ]}
          >
            {group.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const content = (
    <>
      {selectedGroup && (
        <Text style={styles.key}>
          {t('suggestion_key')}: {selectedGroup.key}
        </Text>
      )}
      {canEdit && selectedType && (
        <View style={styles.inputRow}>
          <TextInput
            value={newValue}
            onChangeText={setNewValue}
            placeholder={t('suggestion_value_placeholder')}
            style={styles.input}
          />
          <Button onPress={add}>{t('add')}</Button>
        </View>
      )}
      <ScrollView>
        {stored.length > 0 && (
          <Text style={styles.sectionTitle}>{t('suggestion_saved_values')}</Text>
        )}
        {stored.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={styles.row}
            onPress={() =>
              navigation.navigate('SuggestionUsage', {
                type: selectedType,
                value: suggestion.value,
              })
            }
          >
            <Text style={styles.value}>{suggestion.value}</Text>
            <Text style={styles.usage}>{usageByValue.get(suggestion.value) ?? 0}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
        {storyValues.length > 0 && (
          <Text style={styles.sectionTitle}>{t('suggestion_values_in_story')}</Text>
        )}
        {storyValues.map(([value, usageCount]) => (
          <TouchableOpacity
            key={value}
            style={styles.row}
            onPress={() => navigation.navigate('SuggestionUsage', { type: selectedType, value })}
          >
            <Text style={styles.storyValue}>{value}</Text>
            <Text style={styles.usage}>{usageCount}</Text>
            <View style={styles.icon}>
              <Ionicons
                name="link-outline"
                size={20}
                color={colors.textSecondary}
                accessibilityLabel={t('suggestion_value_from_story')}
              />
            </View>
          </TouchableOpacity>
        ))}
        {selectedType && stored.length === 0 && storyValues.length === 0 && (
          <Text style={styles.empty}>{t('no_suggestions_available')}</Text>
        )}
      </ScrollView>
      <ResponsiveModal
        visible={creatingList}
        onClose={() => setCreatingList(false)}
        contentStyle={styles.modalContent}
      >
        <Text style={styles.modalTitle}>{t('suggestion_new_list')}</Text>
        <TextInput
          value={newListName}
          onChangeText={setNewListName}
          placeholder={t('suggestion_list_name_placeholder')}
          style={commonInputStyles.input}
        />
        <FormActions>
          <Button onPress={() => setCreatingList(false)}>{t('cancel')}</Button>
          <Button onPress={createList}>{t('add')}</Button>
        </FormActions>
      </ResponsiveModal>
      <ResponsiveModal
        visible={renamingList}
        onClose={() => setRenamingList(false)}
        contentStyle={styles.modalContent}
      >
        <Text style={styles.modalTitle}>{t('suggestion_rename_list')}</Text>
        <TextInput
          value={renameListName}
          onChangeText={setRenameListName}
          placeholder={t('suggestion_list_name_placeholder')}
          style={commonInputStyles.input}
        />
        <FormActions>
          <Button onPress={() => setRenamingList(false)}>{t('cancel')}</Button>
          <Button onPress={renameList}>{t('save')}</Button>
        </FormActions>
      </ResponsiveModal>
      <ResponsiveModal
        visible={copying}
        onClose={() => setCopying(false)}
        contentStyle={styles.modalContent}
      >
        <Text style={styles.modalTitle}>{t('suggestion_copy_to')}</Text>
        <ScrollView style={styles.copyList}>
          {copyDestinations.map((group) => (
            <TouchableOpacity
              key={group.type}
              style={styles.copyRow}
              onPress={() => toggleCopyTarget(group.type)}
            >
              <Ionicons
                name={copyTargets.includes(group.type) ? 'checkbox' : 'square-outline'}
                size={22}
                color={colors.primary}
              />
              <Text style={styles.copyLabel}>{group.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <FormActions>
          <Button onPress={() => setCopying(false)}>{t('cancel')}</Button>
          <Button onPress={copyToSelected}>{t('suggestion_copy_confirm')}</Button>
        </FormActions>
      </ResponsiveModal>
    </>
  );

  return (
    <View style={commonContainerStyles.container}>
      <Text style={styles.title}>{t('standard_suggestions_title')}</Text>
      <Text style={styles.description}>{t('standard_suggestions_description')}</Text>
      {isCompact ? (
        <>
          {groupsList}
          {content}
        </>
      ) : (
        <View style={styles.wideLayout}>
          {groupsList}
          <View style={styles.contentColumn}>{content}</View>
        </View>
      )}
    </View>
  );
};

export default SuggestionsScreen;
