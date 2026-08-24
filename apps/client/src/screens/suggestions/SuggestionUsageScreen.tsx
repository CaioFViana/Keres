import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import {
  MainSystemDrawerParamList,
  SuggestionsStackParamList,
} from '../../navigation/MainSystemStack';
import {
  createSuggestionService,
  isNamedListType,
  SuggestionUsage,
} from '../../services/storymanagement/SuggestionService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { ENTITY_TYPE_ICONS } from '../../utils/entityTypeIcons';

type UsageSection = { title: string; data: SuggestionUsage[] };

const SECTION_LABELS: Record<SuggestionUsage['entityType'], string> = {
  Character: 'characters_title',
  CharacterRelation: 'character_relations_title',
  Item: 'items_title',
  ItemJourney: 'item_journeys_title',
  Location: 'locations_title',
  Scene: 'scenes_title',
  Chapter: 'chapters_title',
  Note: 'notes_title',
  WorldRule: 'world_rules_title',
  Choice: 'choices_title',
  Tag: 'tags_title',
  Mode: 'modes_title',
};

const SuggestionUsageScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const navigation = useNavigation<any>();
  useBackButtonHandler({ showWebBackButton: true, onBack: () => navigation.goBack() });
  const route = useRoute<any>();
  const { type, value } = route.params as SuggestionsStackParamList['SuggestionUsage'];
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { userId } = useUserSettingsStore();
  const { canEdit } = useStoryRole(storyId);
  const service = useMemo(() => createSuggestionService(db), [db]);
  const [usages, setUsages] = useState<SuggestionUsage[]>([]);
  const [storedId, setStoredId] = useState<string | null>(null);
  const [storedValues, setStoredValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newValue, setNewValue] = useState(value);
  const [renameUsages, setRenameUsages] = useState(false);
  const [saving, setSaving] = useState(false);
  const commonInputStyles = getCommonInputStyles(colors);
  const catalogOnly = isNamedListType(type);

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const [nextUsages, stored] = await Promise.all([
        service.getSuggestionUsages(type, storyId, value),
        service.getStoredSuggestions(type, storyId),
      ]);
      setUsages(nextUsages);
      setStoredId(stored.find((entry) => entry.value === value)?.id ?? null);
      setStoredValues(stored.map((entry) => entry.value));
    } finally {
      setLoading(false);
    }
  }, [service, storyId, type, value]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('suggestion_value_details'),
        headerRight: () => (
          <View style={styles(colors).headerActions}>
            {canEdit && userId && (
              <TouchableOpacity
                onPress={() => {
                  setNewValue(value);
                  setRenameUsages(false);
                  setRenaming(true);
                }}
                accessibilityLabel={t('rename')}
              >
                <Ionicons name="pencil-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {storedId && canEdit && userId && (
              <TouchableOpacity
                onPress={() => {
                  AppAlert.alert(t('remove'), t('suggestion_remove_saved_message'), [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('remove'),
                      style: 'destructive',
                      onPress: async () => {
                        await service.deleteSuggestion(userId, storedId);
                        navigation.goBack();
                      },
                    },
                  ]);
                }}
                accessibilityLabel={t('suggestion_remove_saved')}
              >
                <Ionicons name="trash-outline" size={24} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [canEdit, catalogOnly, colors, navigation, service, storedId, t, userId, value]),
  );

  const sections = useMemo<UsageSection[]>(() => {
    const grouped = new Map<string, SuggestionUsage[]>();
    usages.forEach((usage) => {
      const entries = grouped.get(usage.entityType) ?? [];
      entries.push(usage);
      grouped.set(usage.entityType, entries);
    });
    return Array.from(grouped.entries()).map(([entityType, data]) => ({
      title: `${t(SECTION_LABELS[entityType as SuggestionUsage['entityType']])} (${data.length})`,
      data,
    }));
  }, [t, usages]);
  const isMerging =
    newValue.trim() !== value &&
    storedValues.some((storedValue) => storedValue === newValue.trim());

  const saveRename = async () => {
    if (!userId || !storyId || !newValue.trim()) return;
    setSaving(true);
    try {
      const result = await service.renameSuggestionValue(
        userId,
        storyId,
        type,
        value,
        newValue,
        renameUsages,
      );
      setRenaming(false);
      AppAlert.alert(
        t('success'),
        result.merged
          ? t('suggestion_merge_success', { count: result.updatedUsages })
          : t('suggestion_rename_success', { count: result.updatedUsages }),
      );
      navigation.goBack();
    } catch (error) {
      AppAlert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openUsage = (usage: SuggestionUsage) => {
    const drawerNavigation =
      navigation.getParent() as DrawerNavigationProp<MainSystemDrawerParamList>;
    if (usage.entityType === 'CharacterRelation') return;
    navigateToEntityDetail(drawerNavigation, usage.entityType as GlobalSearchEntityType, usage.id, {
      onReturn: () =>
        drawerNavigation.navigate('SuggestionsStack', {
          screen: 'SuggestionUsage',
          params: { type, value },
        }),
    });
  };

  const stylesForScreen = styles(colors);
  return (
    <View style={stylesForScreen.container}>
      <Text style={stylesForScreen.value}>{value}</Text>
      <Text style={stylesForScreen.subtitle}>
        {catalogOnly
          ? t('suggestion_catalog_only')
          : t('suggestion_usage_count', { count: usages.length })}
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={stylesForScreen.loading} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.entityType}:${item.id}`}
          renderSectionHeader={({ section }) => (
            <Text style={stylesForScreen.section}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={stylesForScreen.result}>
              <Ionicons
                name={
                  item.entityType === 'CharacterRelation'
                    ? 'git-network-outline'
                    : ENTITY_TYPE_ICONS[item.entityType]
                }
                size={22}
                color={colors.primary}
              />
              <View style={stylesForScreen.resultText}>
                <Text style={stylesForScreen.resultTitle}>{item.title}</Text>
                <Text style={stylesForScreen.resultSnippet}>{item.snippet}</Text>
                {item.entityType === 'CharacterRelation' && item.characterIds && (
                  <View style={stylesForScreen.relationLinks}>
                    {item.characterIds.map((characterId, index) => (
                      <TouchableOpacity
                        key={characterId}
                        onPress={() =>
                          navigateToEntityDetail(
                            navigation.getParent() as DrawerNavigationProp<MainSystemDrawerParamList>,
                            'Character',
                            characterId,
                            {
                              onReturn: () =>
                                (
                                  navigation.getParent() as DrawerNavigationProp<MainSystemDrawerParamList>
                                ).navigate('SuggestionsStack', {
                                  screen: 'SuggestionUsage',
                                  params: { type, value },
                                }),
                            },
                          )
                        }
                      >
                        <Text style={stylesForScreen.relationLink}>
                          {item.characterNames?.[index] ?? t('characters_title')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {item.entityType !== 'CharacterRelation' && (
                <TouchableOpacity style={stylesForScreen.open} onPress={() => openUsage(item)}>
                  <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={stylesForScreen.empty}>{t('suggestion_no_usages')}</Text>
          }
          stickySectionHeadersEnabled={false}
        />
      )}
      <ResponsiveModal
        visible={renaming}
        onClose={() => setRenaming(false)}
        contentStyle={stylesForScreen.modal}
      >
        <Text style={stylesForScreen.modalTitle}>{t('suggestion_rename_value')}</Text>
        <TextInput value={newValue} onChangeText={setNewValue} style={commonInputStyles.input} />
        {usages.length > 0 && (
          <TouchableOpacity
            style={stylesForScreen.checkbox}
            onPress={() => setRenameUsages((current) => !current)}
          >
            <Ionicons
              name={renameUsages ? 'checkbox' : 'square-outline'}
              size={22}
              color={colors.primary}
            />
            <Text style={stylesForScreen.checkboxText}>
              {t('suggestion_rename_usages', { count: usages.length })}
            </Text>
          </TouchableOpacity>
        )}
        {(renameUsages || isMerging) && (
          <Text style={stylesForScreen.warning}>
            {isMerging
              ? t('suggestion_merge_warning', {
                  count: usages.length,
                  oldValue: value,
                  newValue,
                })
              : t('suggestion_rename_usages_warning')}
          </Text>
        )}
        <View style={stylesForScreen.modalActions}>
          <Button onPress={() => setRenaming(false)}>{t('cancel')}</Button>
          <Button
            onPress={saveRename}
            disabled={saving || (isMerging && usages.length > 0 && !renameUsages)}
          >
            {t('save')}
          </Button>
        </View>
      </ResponsiveModal>
    </View>
  );
};

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 14 },
    value: { color: colors.text, fontSize: 22, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
    loading: { marginTop: 24 },
    section: { color: colors.primary, fontSize: 14, fontWeight: '700', paddingVertical: 8 },
    result: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 8,
      flexDirection: 'row',
      marginBottom: 8,
      padding: 12,
    },
    resultText: { flex: 1, marginLeft: 10 },
    resultTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    resultSnippet: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    open: { paddingLeft: 8 },
    empty: { color: colors.textSecondary, padding: 24, textAlign: 'center' },
    relationLinks: { flexDirection: 'row', gap: 10, marginTop: 6 },
    relationLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
    headerActions: { alignItems: 'center', flexDirection: 'row', gap: 16, marginRight: 15 },
    modal: { gap: 12, padding: 16 },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    checkbox: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    checkboxText: { color: colors.text, flex: 1 },
    warning: { color: colors.error, fontSize: 13, lineHeight: 18 },
    modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  });

export default SuggestionUsageScreen;
