import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { FavoriteBehavior, Story } from '@keres/shared/entities/Story';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../hooks/useStoryRole';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { createPackService, type PackSummary } from '../../services/storymanagement/PackService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';

type RootStackParamList = {
  StoryForm: { storyId?: string };
  StorySelection: undefined;
};

type StoryFormScreenRouteProp = NativeStackScreenProps<RootStackParamList, 'StoryForm'>['route'];
type StoryFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StoryForm'>;

const StoryFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation<StoryFormScreenNavigationProp>();
  const route = useRoute<StoryFormScreenRouteProp>();
  const { storyId } = route.params || {};
  useDocumentTitle(storyId ? t('edit_story') : t('create_new_story_screen_title'));
  const commonContainerStyles = getCommonContainerStyles(colors);
  const drizzleDb = useDrizzle();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore(); // Get userId from store
  const scrollBottomPadding = useFormScrollBottomPadding();
  // Creating is always allowed (there is no role before the story exists); editing respects
  // the real role - the edit button in StorySelectionScreen is not filtered by role, so
  // a reader collaborator can open this screen for somebody else's story. Policy
  // (type / favourites / deletion) belongs to the owner alone; a writer still edits title and content.
  const { canEdit: canEditExisting, canManageStoryPolicy: canManageExistingPolicy } =
    useStoryRole(storyId);
  const canEdit = !storyId || canEditExisting;
  const canManageStoryPolicy = !storyId || canManageExistingPolicy;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [description, setDescription] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBehavior, setFavoriteBehavior] = useState<FavoriteBehavior>('individual');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
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
            setTitle(fetchedStory.title);
            setType(fetchedStory.type);
            setDescription(fetchedStory.description);
            setGenre(fetchedStory.genre);
            setLanguage(fetchedStory.language);
            setAuthor(fetchedStory.author);
            setIsFavorite(fetchedStory.isFavorite);
            setFavoriteBehavior(fetchedStory.favoriteBehavior);
            setExtraNotes(fetchedStory.extraNotes);
            setTheme(fetchedStory.theme);
            applyTheme(fetchedStory.theme || 'default');
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
        applyTheme('default');
      }
    };
    loadStory();
  }, [storyId, storyService, userId, t, applyTheme]);

  useEffect(() => {
    if (storyId) return;
    createPackService(drizzleDb)
      .listPacks()
      .then(setPacks)
      .catch((err) => console.error('StoryFormScreen: failed to list packs.', err));
  }, [drizzleDb, storyId]);

  const handleSave = async () => {
    if (!canEdit) return;

    if (!title.trim()) {
      AppAlert.alert(t('error'), t('title_required'));
      return;
    }

    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified')); // New translation key needed
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (storyId) {
        // Update never sends `type` (conversion lives on Story Settings), nor
        // `allowReaderComments` / `normalizeSceneTiming` / log cursors (this form doesn't
        // edit them). Sending hardcoded defaults used to reset those fields, and a writer
        // sending `allowReaderComments: false` would now be rejected as owner-only policy.
        await storyService().updateStory(userId, storyId, {
          title: title.trim(),
          description,
          genre,
          language,
          author,
          isFavorite,
          extraNotes,
          theme,
          ...(canManageStoryPolicy ? { favoriteBehavior } : {}),
        });
        AppAlert.alert(t('success'), t('story_updated_successfully'));
      } else {
        const storyData: Omit<
          Story,
          'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'
        > = {
          userId: userId!,
          title: title.trim(),
          type,
          description,
          genre,
          language,
          author,
          isFavorite,
          favoriteBehavior,
          extraNotes,
          theme,
          timelineEpochDay: null,
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
            setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

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
                setLoading(true);
                await storyService().deleteStory(storyId);
                AppAlert.alert(t('success'), t('story_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete story:', err);
                setError(t('failed_to_delete_story'));
                AppAlert.alert(t('error'), t('failed_to_delete_story'));
              } finally {
                setLoading(false);
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
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
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
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={[styles.scrollViewContent, { paddingBottom: scrollBottomPadding }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {storyId ? t('edit_story') : t('create_new_story_screen_title')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
        {storyId ? t('edit_story_description') : t('create_new_story_screen_description')}
      </Text>

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
        title={title}
        onTitleChange={setTitle}
        type={type}
        onTypeChange={setType}
        typeDisabled={!!storyId || !canEdit}
        favoriteBehaviorDisabled={!canManageStoryPolicy}
        description={description}
        onDescriptionChange={setDescription}
        genre={genre}
        onGenreChange={setGenre}
        author={author}
        onAuthorChange={setAuthor}
        language={language}
        onLanguageChange={setLanguage}
        isFavorite={isFavorite}
        onIsFavoriteChange={setIsFavorite}
        favoriteBehavior={favoriteBehavior}
        onFavoriteBehaviorChange={setFavoriteBehavior}
        extraNotes={extraNotes}
        onExtraNotesChange={setExtraNotes}
        theme={theme}
        onThemeChange={setTheme}
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

      <FormActions stackOnCompact style={styles.saveButton}>
        <Button onPress={handleSave} disabled={!canEdit}>
          {storyId ? t('update_story') : t('create_story')}
        </Button>
        {storyId && (
          <Button
            onPress={handleDelete}
            style={{ backgroundColor: colors.error }}
            disabled={!canManageStoryPolicy}
          >
            {t('delete_story_title')}
          </Button>
        )}
      </FormActions>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  scrollViewContent: {
    padding: 20,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  saveButton: {
    marginTop: 35,
    marginBottom: 0,
  },
  deleteButton: {
    marginTop: 10,
    marginBottom: 15,
    // A cor vem do tema no ponto de uso: este StyleSheet vive fora do componente.
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryFormScreen;
