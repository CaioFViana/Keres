import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import Button from '@/src/components/common/controls/Button/Button';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import type { Story } from '@keres/shared/entities/Story';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useStoryRole } from '../../hooks/useStoryRole';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { createPackService, type PackSummary } from '../../services/storymanagement/PackService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type RootStackParamList = {
  StoryForm: { storyId?: string };
  StorySelection: undefined;
};

type StoryFormScreenRouteProp = NativeStackScreenProps<RootStackParamList, 'StoryForm'>['route'];
type StoryFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StoryForm'>;

const StoryFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StoryFormScreenNavigationProp>();
  const route = useRoute<StoryFormScreenRouteProp>();
  const { storyId } = route.params || {};
  useScreenHeader({
    target: 'parent',
    title: storyId ? t('edit_story') : t('create_new_story_screen_title'),
  });
  const commonContainerStyles = getCommonContainerStyles(colors);
  const drizzleDb = useDrizzle();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore(); // Get userId from store

  // Creating is always allowed (there is no role before the story exists); editing respects
  // the real role - the edit button in StorySelectionScreen is not filtered by role, so
  // a reader collaborator can open this screen for somebody else's story. Policy
  // (type / favourites / deletion) belongs to the owner alone; a writer still edits title and content.
  const { canEdit: canEditExisting, canManageStoryPolicy: canManageExistingPolicy } =
    useStoryRole(storyId);
  const canEdit = !storyId || canEditExisting;
  const canManageStoryPolicy = !storyId || canManageExistingPolicy;

  const identity = useStoryIdentityDraft();
  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Packs are offered only while creating: applying one to an existing story would mean writing its
  // contents as ordinary edits, which is exactly the operation-log flood the design avoids.
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);

  useEffect(() => {
    const loadStory = async () => {
      if (storyId) {
        try {
          setLoading(true);
          const fetchedStory = await storyService().getStoryById(storyId, userId ?? undefined);
          if (fetchedStory) {
            identity.applyStoryIdentity(fetchedStory);
          } else {
            setError(t('story_not_found'));
          }
        } catch (err) {
          console.error('Failed to load story:', err);
          setError(t('failed_to_load_story'));
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadStory();
  }, [storyId, storyService, userId, t, identity.applyStoryIdentity]);

  useEffect(() => {
    if (storyId) return;
    createPackService(drizzleDb)
      .listPacks()
      .then(setPacks)
      .catch((err) => console.error('StoryFormScreen: failed to list packs.', err));
  }, [drizzleDb, storyId]);

  const handleSave = () =>
    runSave(async () => {
      if (!canEdit) return;

      if (!identity.title.trim()) {
        AppAlert.alert(t('error'), t('title_required'));
        return;
      }

      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified')); // New translation key needed
        return;
      }

      setError(null);

      try {
        if (storyId) {
          // Update never sends `type` (conversion lives on Story Settings), nor
          // `allowReaderComments` / `normalizeSceneTiming` / log cursors (this form doesn't
          // edit them). Sending hardcoded defaults used to reset those fields, and a writer
          // sending `allowReaderComments: false` would now be rejected as owner-only policy.
          await storyService().updateStory(userId, storyId, {
            title: identity.title.trim(),
            description: identity.description,
            genre: identity.genre,
            language: identity.language,
            author: identity.author,
            isFavorite: identity.isFavorite,
            extraNotes: identity.extraNotes,
            ...(canManageStoryPolicy ? { favoriteBehavior: identity.favoriteBehavior } : {}),
          });
          AppAlert.alert(t('success'), t('story_updated_successfully'));
        } else {
          const storyData: Omit<
            Story,
            'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'
          > = {
            userId: userId!,
            title: identity.title.trim(),
            type: identity.type,
            description: identity.description,
            genre: identity.genre,
            language: identity.language,
            author: identity.author,
            isFavorite: identity.isFavorite,
            favoriteBehavior: identity.favoriteBehavior,
            extraNotes: identity.extraNotes,
            // Appearance is configured after creation under Customization. `null` selects the
            // application default and keeps old exports and newly-created stories consistent.
            theme: null,
            timelineEpochDay: null,
            timelineEpochSeconds: null,
            normalizeSceneTiming: false,
            allowReaderComments: false,
            // On for a new story, unlike the switches around it: linking mentions makes no judgement
            // about the writer's work, it only saves a tap while reading. It is also invisible until
            // the story has both entities and prose, so it cannot surprise anyone early. Existing
            // stories stay off - see migration 0016.
            autoLinkMentions: true,
            // Off, like every existing story: whether an element must be referenced somewhere is the
            // writer's judgement. Story Analysis keeps reporting broken references either way.
            completenessChecks: false,
            // The stats system is turned on later, in Story Settings: a new story
            // never comes into the world with it.
            statSystem: false,
            statNotation: 'letter',
            vocabulary: null,
            lastOperationLog: 0,
            lastServerSyncedLog: 0,
          };
          if (selectedPackIds.length > 0) {
            const packService = createPackService(drizzleDb);
            const conflicts = await packService.findConflicts(selectedPackIds);
            if (conflicts.length > 0) {
              // Named here rather than left to the import's integrity check, whose message describes a
              // corrupt file and not two packs somebody chose.
              AppAlert.alert(
                t('packs_conflict_title'),
                conflicts
                  .map((conflict) =>
                    t(`packs_conflict_${conflict.kind}`, { detail: conflict.detail }),
                  )
                  .join('\n'),
              );

              return;
            }
            await packService.createStoryWithPacks(userId, storyData, selectedPackIds);
          } else {
            await storyService().createStory(userId, storyData);
          }
          AppAlert.alert(t('success'), t('story_created_successfully'));
        }
        navigation.goBack(); // Go back to the previous screen (StorySelection)
      } catch (err) {
        console.error('Failed to save story:', err);
        setError(t('failed_to_save_story'));
        AppAlert.alert(t('error'), t('failed_to_save_story'));
      }
    });

  const handleDelete = () => {
    if (!canManageStoryPolicy) return;

    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    AppAlert.alert(
      t('delete_story_title'),
      t('delete_story_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            if (storyId) {
              try {
                setDeleting(true);
                await storyService().deleteStory(storyId);
                AppAlert.alert(t('success'), t('story_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete story:', err);
                setError(t('failed_to_delete_story'));
                AppAlert.alert(t('error'), t('failed_to_delete_story'));
              } finally {
                setDeleting(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  if (loading) {
    return <ScreenLoading />;
  }

  if (error && !storyId) {
    // Only show error if creating a new story and something went wrong
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{error}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  return (
    <EntityFormContainer
      title={storyId ? t('edit_story') : t('create_new_story_screen_title')}
      description={storyId ? t('edit_story_description') : t('create_new_story_screen_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting || !canEdit}>
            {storyId ? t('update_story') : t('create_story')}
          </Button>
          {storyId && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting || !canManageStoryPolicy}
            >
              {t('delete_story_title')}
            </Button>
          )}
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
        onTypeChange={identity.setType}
        typeDisabled={!!storyId || !canEdit}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        editable={canEdit}
      />

      {!storyId && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            {t('packs_apply_title')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {t('packs_apply_hint')}
          </Text>
          {packs.length > 0 ? (
            <MultiSelectPill
              options={packs.map((pack) => ({ label: pack.name, value: pack.id }))}
              selectedValues={selectedPackIds}
              onSelectionChange={setSelectedPackIds}
              placeholder={t('packs_apply_title')}
            />
          ) : (
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {t('packs_apply_none')}
            </Text>
          )}
        </>
      )}
    </EntityFormContainer>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryFormScreen;
