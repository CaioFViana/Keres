import { Button } from '@/src/components/common';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import GalleryCoverField from '@/src/components/features/gallery/GalleryCoverField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateAcrossStacks } from '../../hooks/useNavigateAcrossStacks';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useLoadedStory } from './useLoadedStory';
import { useStorySettingsSave } from './useStorySettingsSave';

/** The cover, which saves here, and the way to the story's theme, which has its own screen and its own save. */
const StorySettingsAppearanceScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const navigateAcross = useNavigateAcrossStacks();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { saving, save } = useStorySettingsSave();
  const [coverGalleryId, setCoverGalleryId] = useState<string | null>(null);

  useScreenHeader({ target: 'parent', title: t('appearance_title') });

  const { loading, error } = useLoadedStory(
    useCallback((story) => setCoverGalleryId(story.coverGalleryId ?? null), []),
  );

  if (!storyId) {
    return (
      <ScreenError
        message={t('no_story_selected_for_settings')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;

  return (
    <EntityFormContainer
      title={t('appearance_title')}
      description={t('story_settings_section_appearance_description')}
      actions={
        <Button onPress={() => void save({ coverGalleryId })} disabled={!canEdit || saving}>
          {t('update_story')}
        </Button>
      }
    >
      {!canEdit && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_read_only_error')}
        </Text>
      )}
      <Text style={[styles.label, { color: colors.text }]}>{t('cover')}</Text>
      <GalleryCoverField
        storyId={storyId}
        value={coverGalleryId}
        onChange={setCoverGalleryId}
        editable={canEdit}
      />

      <TouchableOpacity
        testID="story-settings-theme"
        style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigateAcross('CustomizationStack', 'StoryAppearance')}
      >
        <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
        <View style={styles.themeBody}>
          <Text style={[styles.themeTitle, { color: colors.text }]}>{t('theme')}</Text>
          <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
            {t('customization_theme_description')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </EntityFormContainer>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 4 },
  themeCard: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    padding: 14,
  },
  themeBody: { flexGrow: 1, flexShrink: 1 },
  themeTitle: { fontSize: 16, fontWeight: '700' },
  themeDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
});

export default StorySettingsAppearanceScreen;
