import { Button, SingleSelectPill } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import type { FavoriteBehavior } from '@keres/shared/entities/Story';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { useLoadedStory } from './useLoadedStory';
import { useStorySettingsSave } from './useStorySettingsSave';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

/**
 * The story's identity (title, type, description, genre, author, language, notes), the adults-only flag and
 * the reading preferences. Saves only these; the cover, the theme and the server have sections of their own.
 */
const StorySettingsGeneralScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit, canManageStoryPolicy } = useStoryRole(storyId);
  const drizzleDb = useDrizzle();
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore();
  const identity = useStoryIdentityDraft();
  const { saving, save } = useStorySettingsSave();

  useScreenHeader({
    target: 'parent',
    title: t('story_settings_section_general'),
  });

  const [normalizeSceneTiming, setNormalizeSceneTiming] = useState(false);
  const [autoLinkMentions, setAutoLinkMentions] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [initialIsNsfw, setInitialIsNsfw] = useState(false);
  const [converting, setConverting] = useState(false);

  const applyStoryIdentity = identity.applyStoryIdentity;
  const { loading, error } = useLoadedStory(
    useCallback(
      (story) => {
        applyStoryIdentity(story);
        setNormalizeSceneTiming(story.normalizeSceneTiming);
        setAutoLinkMentions(story.autoLinkMentions);
        setIsNsfw(story.isNsfw ?? false);
        setInitialIsNsfw(story.isNsfw ?? false);
      },
      [applyStoryIdentity],
    ),
  );

  const doSave = async () => {
    if (!identity.title.trim()) {
      AppAlert.alert(t('error'), t('title_required'));
      return;
    }
    await save({
      title: identity.title.trim(),
      description: identity.description,
      genre: identity.genre,
      language: identity.language,
      author: identity.author,
      isFavorite: identity.isFavorite,
      extraNotes: identity.extraNotes,
      normalizeSceneTiming,
      autoLinkMentions,
      ...(canManageStoryPolicy ? { favoriteBehavior: identity.favoriteBehavior, isNsfw } : {}),
    });
  };

  const handleSave = () => {
    // Flagging adults-only expels every collaborator who is not age-verified, on the server, as
    // soon as the change syncs - confirm the blast radius before writing it.
    if (canManageStoryPolicy && isNsfw && !initialIsNsfw) {
      AppAlert.alert(t('story_nsfw_confirm_title'), t('story_nsfw_confirm_message'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: () => void doSave() },
      ]);
      return;
    }
    return doSave();
  };

  const handleTypeChange = (newType: 'linear' | 'branching') => {
    if (!storyId || !userId || !canManageStoryPolicy || newType === identity.type) return;

    if (newType === 'branching') {
      AppAlert.alert(t('convert_to_branching_title'), t('convert_to_branching_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('convert'),
          onPress: async () => {
            try {
              setConverting(true);
              await storyService.convertStoryType(userId, storyId, 'branching');
              identity.setType('branching');
              AppAlert.alert(t('success'), t('story_type_converted_successfully'));
            } catch (err) {
              console.error('Failed to convert story to branching:', err);
              AppAlert.alert(t('error'), t('failed_to_convert_story_type'));
            } finally {
              setConverting(false);
            }
          },
        },
      ]);
      return;
    }

    void (async () => {
      try {
        setConverting(true);
        const compatibility = await storyService.checkLinearCompatibility(storyId);
        setConverting(false);
        if (!compatibility.compatible) {
          const reasonLines = compatibility.reasons
            .map(
              (reason) => `• ${reason.chapterName}: ${t(`linear_incompatibility_${reason.kind}`)}`,
            )
            .join('\n');
          AppAlert.alert(
            t('cannot_convert_to_linear_title'),
            `${t('cannot_convert_to_linear_message')}\n\n${reasonLines}`,
          );
          return;
        }
        AppAlert.alert(t('convert_to_linear_title'), t('convert_to_linear_message'), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('convert'),
            style: 'destructive',
            onPress: async () => {
              try {
                setConverting(true);
                await storyService.convertStoryType(userId, storyId, 'linear');
                identity.setType('linear');
                AppAlert.alert(t('success'), t('story_type_converted_successfully'));
              } catch (err) {
                console.error('Failed to convert story to linear:', err);
                AppAlert.alert(t('error'), t('failed_to_convert_story_type'));
              } finally {
                setConverting(false);
              }
            },
          },
        ]);
      } catch (err) {
        setConverting(false);
        console.error('Failed to check linear compatibility:', err);
        AppAlert.alert(t('error'), t('failed_to_check_story_compatibility'));
      }
    })();
  };

  if (!storyId) {
    return (
      <ScreenError
        message={t('no_story_selected_for_settings')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (loading || converting) return <ScreenLoading />;
  if (error) return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;

  return (
    <EntityFormContainer
      title={t('story_settings_section_general')}
      description={t('story_settings_section_general_description')}
      actions={
        <Button onPress={handleSave} disabled={!canEdit || saving}>
          {t('update_story')}
        </Button>
      }
    >
      {!canEdit && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_read_only_error')}
        </ThemedText>
      )}
      {canEdit && !canManageStoryPolicy && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_owner_only_error')}
        </ThemedText>
      )}

      <StoryFieldsForm
        {...identity.storyFieldsFormProps}
        onTypeChange={handleTypeChange}
        typeDisabled={!canManageStoryPolicy}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        showFavoriteBehavior={false}
        editable={canEdit}
      />

      <View
        style={[
          styles.preferencesCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.preferenceRow,
            styles.preferenceRowDivider,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.preferenceBody}>
            <Text style={[styles.preferenceTitle, { color: colors.text }]}>{t('story_nsfw')}</Text>
            <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
              {t('story_nsfw_description')}
            </Text>
          </View>
          <ThemedSwitch value={isNsfw} onValueChange={setIsNsfw} disabled={!canManageStoryPolicy} />
        </View>
        <View
          style={[
            styles.preferenceRow,
            styles.preferenceRowDivider,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.preferenceBody}>
            <Text style={[styles.preferenceTitle, { color: colors.text }]}>
              {t('normalize_scene_timing')}
            </Text>
            <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
              {t('normalize_scene_timing_description')}
            </Text>
          </View>
          <ThemedSwitch
            value={normalizeSceneTiming}
            onValueChange={setNormalizeSceneTiming}
            disabled={!canEdit}
          />
        </View>
        <View
          style={[
            styles.preferenceRow,
            styles.preferenceRowDivider,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.preferenceBody}>
            <Text style={[styles.preferenceTitle, { color: colors.text }]}>
              {t('auto_link_mentions')}
            </Text>
            <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
              {t('auto_link_mentions_description')}
            </Text>
          </View>
          <ThemedSwitch
            value={autoLinkMentions}
            onValueChange={setAutoLinkMentions}
            disabled={!canEdit}
          />
        </View>
        <View>
          <Text style={[styles.preferenceTitle, { color: colors.text }]}>
            {t('favorite_behavior')}
          </Text>
          <SingleSelectPill
            options={[
              { label: t('favorite_behavior_global'), value: 'global' },
              { label: t('favorite_behavior_individual'), value: 'individual' },
              { label: t('favorite_behavior_individual_public'), value: 'individual_public' },
            ]}
            value={identity.favoriteBehavior}
            onValueChange={(value) => identity.setFavoriteBehavior(value as FavoriteBehavior)}
            placeholder={t('favorite_behavior')}
            disabled={!canManageStoryPolicy}
          />
          <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
            {t(`favorite_behavior_${identity.favoriteBehavior}_description`)}
          </Text>
        </View>
      </View>
    </EntityFormContainer>
  );
};

const styles = StyleSheet.create({
  preferencesCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
  },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  preferenceRowDivider: { borderBottomWidth: 1, marginBottom: 10, paddingBottom: 14 },
  preferenceBody: { flex: 1 },
  preferenceTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  preferenceDescription: { marginTop: 3 },
});

export default StorySettingsGeneralScreen;
