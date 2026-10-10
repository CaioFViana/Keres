import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryBackupExport } from '../../hooks/useStoryBackupExport';
import type { StoryShareStackParamList } from '../../navigation/StoryShareStack';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useHeaderBackActionStore } from '../../state/headerBackActionStore';
import { useStoryStore } from '../../state/storyStore';
import { type ThemeColors, useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { typography } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { isServerless } from '../../utils/clientFlavor';

/**
 * Where the story leaves the app: published on the server's page, as the manuscript document, or as a copy
 * of the whole story to keep. Each opens the place that does it; the copy is made right here.
 */
const StoryShareIndexScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<StoryShareStackParamList, 'StoryShareIndex'>>();
  const story = useStoryStore((state) => state.selectedStory);
  const backup = useStoryBackupExport(story ? { id: story.id, title: story.title } : null);
  // Only the owner publishes: for anyone else the entry says so instead of opening a screen that refuses.
  const { canManageStoryPolicy, loading: roleLoading } = useStoryRole(story?.id);
  const canPublish = roleLoading || canManageStoryPolicy;

  useScreenHeader({ target: 'parent', title: t('story_share_title') });

  const styles = useThemedStyles(createStyles);

  // Both screens are opened from the dashboard too, which leaves a way back to the dashboard for them. Opened from
  // here, back must come back here.
  const openHere = (screen: 'StoryPublish' | 'ManuscriptExport') => {
    useHeaderBackActionStore.getState().clearCrossStackReturnAction(screen);
    navigation.navigate(screen);
  };

  const entries: {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    disabled?: boolean;
    open: () => void;
  }[] = [
    ...(isServerless()
      ? []
      : [
          {
            id: 'publish',
            icon: 'cloud-upload-outline' as const,
            title: t('story_share_publish_title'),
            description: t(
              canPublish ? 'story_share_publish_description' : 'story_share_publish_owner_only',
            ),
            disabled: !canPublish,
            open: () => openHere('StoryPublish'),
          },
        ]),
    {
      id: 'manuscript',
      icon: 'document-text-outline' as const,
      title: t('export_manuscript_title'),
      description: t('story_share_manuscript_description'),
      open: () => openHere('ManuscriptExport'),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('story_share_intro')}</Text>

      <View style={styles.grid}>
        {entries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={[styles.card, styles.gridCard, entry.disabled && styles.cardDisabled]}
            testID={`story-share-${entry.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!entry.disabled }}
            disabled={entry.disabled}
            onPress={entry.open}
          >
            <View style={styles.cardRow}>
              <Ionicons name={entry.icon} size={26} color={colors.primary} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{entry.title}</Text>
                <Text style={styles.cardDescription}>{entry.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScreenSection title={t('story_share_backup_title')} />
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="archive-outline" size={26} color={colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.cardDescription}>{t('story_share_backup_description')}</Text>
          </View>
        </View>
        <View style={styles.options}>
          <TouchableOpacity
            style={[styles.option, backup.exporting && styles.optionDisabled]}
            testID="story-share-backup-json"
            disabled={backup.exporting}
            onPress={() => void backup.exportJson()}
          >
            <Ionicons name="share-outline" size={18} color={colors.primary} />
            <Text style={styles.optionLabel}>{t('export_story_choose_json')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, backup.exporting && styles.optionDisabled]}
            testID="story-share-backup-zip"
            disabled={backup.exporting}
            onPress={() => void backup.exportZip()}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.optionLabel}>{t('export_story_choose_zip')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.note}>
          {backup.exporting ? t('export_story_in_progress') : t('export_story_choose_message')}
        </Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    // Where the story can go: cards side by side when there is room, one under the other when there is not.
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    gridCard: { flexGrow: 1, flexBasis: 320, marginBottom: 0 },
    intro: { ...typography.body, color: colors.textSecondary, marginBottom: 8 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 12,
      padding: 14,
    },
    cardDisabled: { opacity: 0.6 },
    cardRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    cardBody: { flex: 1 },
    cardTitle: { ...typography.sectionTitle, color: colors.text },
    cardDescription: { ...typography.hint, color: colors.textSecondary, marginTop: 2 },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    option: {
      alignItems: 'center',
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    optionDisabled: { opacity: 0.5 },
    optionLabel: { ...typography.label, color: colors.primary },
    note: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 8 },
  });

export default StoryShareIndexScreen;
