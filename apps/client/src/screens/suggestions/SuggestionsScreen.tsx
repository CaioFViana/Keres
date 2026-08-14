import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { Ionicons } from '@expo/vector-icons';
import { AttributeType, STORY_SCHEMA_ENTITY_TYPES, StorySchemaEntityType } from '@keres/shared';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { SuggestionSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createStorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import {
  createSuggestionService,
  customAttributeSuggestionType,
} from '../../services/storymanagement/SuggestionService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useDocumentTitle } from '../../utils/documentTitle';

type SuggestionGroup = { type: string; label: string; key: string };

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
  useBackButtonHandler();
  const { t } = useTranslation();
  useDocumentTitle(t('standard_suggestions_title'));
  const { colors } = useTheme();
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
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const loadGroups = useCallback(async () => {
    if (!storyId) return setGroups([]);
    const native = Object.entries(entityFieldMetadata).flatMap(([entity, fields]) =>
      fields
        .filter((field) => field.isSuggestion && field.suggestionsSource)
        .map((field) => ({
          type: field.suggestionsSource!,
          key: field.suggestionsSource!,
          label: `${t(ENTITY_LABELS[entity] ?? entity)} · ${t(field.label)}`,
        })),
    );
    const schemaService = createStorySchemaFieldService(db);
    const batches = await Promise.all(
      STORY_SCHEMA_ENTITY_TYPES.map((entityType) =>
        schemaService.getFieldsByStoryAndEntityType(storyId, entityType),
      ),
    );
    const custom = batches.flatMap((fields, index) =>
      fields
        .filter((field) => field.type === AttributeType.SUGGESTION)
        .map((field) => ({
          type: customAttributeSuggestionType(field.id),
          key: field.key,
          label: `${t(SCHEMA_ENTITY_LABELS[STORY_SCHEMA_ENTITY_TYPES[index]])} · ${field.name}`,
        })),
    );
    const next = [...native, ...custom].sort((a, b) => a.label.localeCompare(b.label));
    setGroups(next);
    setSelectedType((current) =>
      current && next.some((group) => group.type === current) ? current : (next[0]?.type ?? null),
    );
  }, [db, storyId, t]);

  const loadStored = useCallback(async () => {
    if (!storyId || !selectedType) return setStored([]);
    setStored(await suggestionService.getStoredSuggestions(selectedType, storyId));
  }, [selectedType, storyId, suggestionService]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('standard_suggestions_title') });
      loadGroups();
    }, [loadGroups, navigation, t]),
  );
  useEffect(() => {
    loadStored();
  }, [loadStored]);
  useEffect(() => {
    const refresh = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadStored();
    };
    entityEventEmitter.on('suggestion_changed', refresh);
    return () => entityEventEmitter.off('suggestion_changed', refresh);
  }, [loadStored, storyId]);

  const add = async () => {
    if (!userId || !storyId || !selectedType || !newValue.trim()) return;
    try {
      await suggestionService.createSuggestion(userId, selectedType, newValue, storyId);
      setNewValue('');
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };
  const saveEdit = async () => {
    if (!userId || !editingId || !editingValue.trim()) return;
    try {
      await suggestionService.updateSuggestion(userId, editingId, editingValue);
      setEditingId(null);
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    }
  };
  const remove = (id: string) =>
    AppAlert.alert(t('delete'), t('delete_suggestion_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (userId) await suggestionService.deleteSuggestion(userId, id);
        },
      },
    ]);

  const selectedGroup = groups.find((group) => group.type === selectedType);
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    title: { color: colors.text, fontSize: 24, fontWeight: 'bold' },
    description: { color: colors.textSecondary, marginTop: 5, marginBottom: 16 },
    // Compacto: tira de chips com rolagem horizontal (cabe bem em telas estreitas). Largo:
    // coluna fixa à esquerda com a lista completa de grupos, sem depender de rolagem
    // horizontal para alcançar grupos "fora da tela" - o problema original nesta tela.
    wideLayout: { flex: 1, flexDirection: 'row', gap: 20 },
    // Rolagem vertical com quebra de linha, não rolagem horizontal - numa lista com muitos
    // grupos, um chip "fora da tela" para o lado não tinha nenhuma pista visual de que
    // existia mais coisa para rolar; quebrando linha, tudo fica alcançável só descendo.
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
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    value: { flex: 1, color: colors.text, fontSize: 16 },
    icon: { padding: 7 },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 28 },
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
        {stored.map((suggestion) => (
          <View key={suggestion.id} style={styles.row}>
            {editingId === suggestion.id ? (
              <TextInput value={editingValue} onChangeText={setEditingValue} style={styles.input} />
            ) : (
              <Text style={styles.value}>{suggestion.value}</Text>
            )}
            {canEdit &&
              (editingId === suggestion.id ? (
                <TouchableOpacity style={styles.icon} onPress={saveEdit}>
                  <Ionicons name="checkmark" size={22} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.icon}
                    onPress={() => {
                      setEditingId(suggestion.id);
                      setEditingValue(suggestion.value);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.icon} onPress={() => remove(suggestion.id)}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </>
              ))}
          </View>
        ))}
        {selectedType && stored.length === 0 && (
          <Text style={styles.empty}>{t('no_suggestions_available')}</Text>
        )}
      </ScrollView>
    </>
  );

  return (
    <View style={styles.container}>
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
