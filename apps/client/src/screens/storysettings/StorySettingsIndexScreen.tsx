import { Button } from '@/src/components/common';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateAcrossStacks } from '../../hooks/useNavigateAcrossStacks';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { StorySettingsStackParamList } from '../../navigation/StorySettingsStack';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { isServerless } from '../../utils/clientFlavor';
import { useResetToStorySelection } from './useResetToStorySelection';

type Entry = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descriptionKey: string;
  open: () => void;
};

/**
 * The story's settings, one section per screen, each saving on its own. Vocabulary, custom fields and
 * suggestions are the screens the Customization menu already has; they are opened from here and return here.
 */
const StorySettingsIndexScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<StorySettingsStackParamList, 'StorySettingsIndex'>>();
  const navigateAcross = useNavigateAcrossStacks();
  const resetToStorySelection = useResetToStorySelection();
  const drizzleDb = useDrizzle();
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canManageStoryPolicy } = useStoryRole(storyId);
  const [deleting, setDeleting] = useState(false);

  useScreenHeader({ target: 'parent', title: t('story_settings_title') });

  const entries: Entry[] = [
    {
      id: 'general',
      icon: 'document-text-outline',
      titleKey: 'story_settings_section_general',
      descriptionKey: 'story_settings_section_general_description',
      open: () => navigation.navigate('StorySettingsGeneral'),
    },
    {
      id: 'appearance',
      icon: 'color-palette-outline',
      titleKey: 'appearance_title',
      descriptionKey: 'story_settings_section_appearance_description',
      open: () => navigation.navigate('StorySettingsAppearance'),
    },
    {
      id: 'vocabulary',
      icon: 'text-outline',
      titleKey: 'vocabulary_title',
      descriptionKey: 'vocabulary_index_description',
      open: () => navigateAcross('CustomizationStack', 'Vocabulary'),
    },
    {
      id: 'schema',
      icon: 'construct-outline',
      titleKey: 'story_schema_management_title',
      descriptionKey: 'customization_schema_description',
      open: () => navigateAcross('CustomizationStack', 'StorySchemaList'),
    },
    {
      id: 'suggestions',
      icon: 'bulb-outline',
      titleKey: 'standard_suggestions_title',
      descriptionKey: 'customization_suggestions_description',
      open: () => navigateAcross('CustomizationStack', 'Suggestions'),
    },
    // A story is linked to a server and its people only where there is a server to link to.
    ...(isServerless()
      ? []
      : [
          {
            id: 'collaboration',
            icon: 'cloud-outline' as const,
            titleKey: 'story_settings_section_collaboration',
            descriptionKey: 'story_settings_section_collaboration_description',
            open: () => navigation.navigate('StorySettingsCollaboration'),
          },
        ]),
  ];

  const handleDelete = () => {
    if (!storyId || !canManageStoryPolicy) return;
    AppAlert.alert(t('delete_story_title'), t('delete_story_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await storyService.deleteStory(storyId);
            AppAlert.alert(t('success'), t('story_deleted_successfully'));
            resetToStorySelection();
          } catch (err) {
            console.error('Failed to delete story:', err);
            AppAlert.alert(t('error'), t('failed_to_delete_story'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 40 },
        intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 10,
        },
        body: { flexGrow: 1, flexShrink: 1 },
        title: { fontSize: 16, fontWeight: '700', color: colors.text },
        description: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
        danger: { marginTop: 18 },
        dangerLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
      }),
    [colors],
  );

  if (!storyId) {
    return (
      <View style={styles.root}>
        <Text style={styles.intro}>{t('no_story_selected_for_settings')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('story_settings_index_intro')}</Text>
        {entries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.card}
            testID={`story-settings-${entry.id}`}
            onPress={entry.open}
          >
            <Ionicons name={entry.icon} size={24} color={colors.primary} />
            <View style={styles.body}>
              <Text style={styles.title}>{t(entry.titleKey)}</Text>
              <Text style={styles.description}>{t(entry.descriptionKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        <View style={styles.danger}>
          <Text style={styles.dangerLabel}>{t('story_settings_danger_zone')}</Text>
          <Button
            onPress={handleDelete}
            style={{ backgroundColor: colors.error }}
            disabled={!canManageStoryPolicy || deleting}
          >
            {t('delete_story_title')}
          </Button>
          {!canManageStoryPolicy && (
            <Text style={[styles.dangerLabel, { marginTop: 8 }]}>{t('story_owner_only_error')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default StorySettingsIndexScreen;
