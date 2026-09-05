import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Button, SingleSelectPill } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import StoryCollaborationSection from '@/src/components/features/story/StoryCollaborationSection/StoryCollaborationSection';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import type { FavoriteBehavior, Story } from '@keres/shared/entities/Story';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';

type StorySettingsScreenNavigationProp = DrawerNavigationProp<
  MainSystemDrawerParamList,
  'MainDashboard'
>;

const StorySettingsScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StorySettingsScreenNavigationProp>();
  const { selectedStory, setSelectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const { canEdit, canManageStoryPolicy } = useStoryRole(storyId);
  const drizzleDb = useDrizzle();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore();
  const identity = useStoryIdentityDraft();

  useScreenHeader({
    target: 'self',
    title: t('story_settings_title'),
  });

  const [normalizeSceneTiming, setNormalizeSceneTiming] = useState(false);
  const [allowReaderComments, setAllowReaderComments] = useState(false);
  const [autoLinkMentions, setAutoLinkMentions] = useState(false);
  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) {
      setLoading(false);
      return;
    }
    const loadStory = async () => {
      try {
        setLoading(true);
        const fetchedStory = await storyService().getStoryById(storyId, userId ?? undefined);
        if (!fetchedStory) {
          setError(t('story_not_found'));
          return;
        }
        identity.applyStoryIdentity(fetchedStory);
        setNormalizeSceneTiming(fetchedStory.normalizeSceneTiming);
        setAllowReaderComments(fetchedStory.allowReaderComments);
        setAutoLinkMentions(fetchedStory.autoLinkMentions);
      } catch (err) {
        console.error('Failed to load story or servers:', err);
        setError(t('failed_to_load_story_settings'));
      } finally {
        setLoading(false);
      }
    };
    void loadStory();
  }, [storyId, storyService, userId, t, identity.applyStoryIdentity]);

  const handleSave = () =>
    runSave(async () => {
      if (!storyId) return;
      if (!identity.title.trim()) {
        AppAlert.alert(t('error'), t('title_required'));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      setError(null);
      try {
        const storyData: Partial<
          Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>
        > = {
          title: identity.title.trim(),
          description: identity.description,
          genre: identity.genre,
          language: identity.language,
          author: identity.author,
          isFavorite: identity.isFavorite,
          extraNotes: identity.extraNotes,
          normalizeSceneTiming,
          autoLinkMentions,
          ...(canManageStoryPolicy
            ? { favoriteBehavior: identity.favoriteBehavior, allowReaderComments }
            : {}),
        };
        await storyService().updateStory(userId, storyId, storyData);
        if (selectedStory) setSelectedStory({ ...selectedStory, ...storyData });
        AppAlert.alert(t('success'), t('story_updated_successfully'));
        navigation.goBack();
      } catch (err) {
        console.error('Failed to save story settings:', err);
        setError(t('failed_to_save_story_settings'));
        AppAlert.alert(t('error'), t('failed_to_save_story_settings'));
      }
    });

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
              await storyService().convertStoryType(userId, storyId, 'branching');
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
        const compatibility = await storyService().checkLinearCompatibility(storyId);
        setConverting(false);
        if (!compatibility.compatible) {
          const reasonLines = compatibility.reasons
            .map((reason) => `• ${reason.chapterName}: ${t(`linear_incompatibility_${reason.kind}`)}`)
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
                await storyService().convertStoryType(userId, storyId, 'linear');
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

  const handleDelete = () => {
    if (!storyId || !canManageStoryPolicy) return;
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    AppAlert.alert(t('delete_story_title'), t('delete_story_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await storyService().deleteStory(storyId);
            AppAlert.alert(t('success'), t('story_deleted_successfully'));
            const rootStackNavigation = navigation.getParent();
            const resetToStorySelection = CommonActions.reset({
              index: 0,
              routes: [{ name: 'StorySelection' }],
            });
            if (rootStackNavigation) rootStackNavigation.dispatch(resetToStorySelection);
            else navigation.dispatch(resetToStorySelection);
          } catch (err) {
            console.error('Failed to delete story:', err);
            setError(t('failed_to_delete_story'));
            AppAlert.alert(t('error'), t('failed_to_delete_story'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (!storyId) {
    return (
      <ScreenError message={t('no_story_selected_for_settings')} onGoBack={() => navigation.goBack()} />
    );
  }
  if (loading || converting) return <ScreenLoading />;
  if (error) return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;

  return (
    <EntityFormContainer
      title={t('story_settings_screen_title')}
      description={t('story_settings_screen_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={!canEdit || saving || deleting}>
            {t('update_story')}
          </Button>
          <Button
            onPress={handleDelete}
            style={{ backgroundColor: colors.error }}
            disabled={!canManageStoryPolicy || saving || deleting}
          >
            {t('delete_story_title')}
          </Button>
        </>
      }
    >
      {!canEdit && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_read_only_error')}
        </Text>
      )}
      {canEdit && !canManageStoryPolicy && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_owner_only_error')}
        </Text>
      )}

      <StoryFieldsForm
        {...identity.storyFieldsFormProps}
        onTypeChange={handleTypeChange}
        typeDisabled={!canManageStoryPolicy}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        showFavoriteBehavior={false}
        editable={canEdit}
      />

      <View style={[styles.preferencesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      <StoryCollaborationSection
        storyId={storyId}
        allowReaderComments={allowReaderComments}
        onAllowReaderCommentsChange={setAllowReaderComments}
        canManageStoryPolicy={canManageStoryPolicy}
      />
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

export default StorySettingsScreen;
