import Button from '@/src/components/common/controls/Button/Button';
import StoryFieldsForm from '@/src/components/features/story/StoryFieldsForm/StoryFieldsForm';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { FavoriteBehavior, Story } from '@keres/shared/entities/Story';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../hooks/useStoryRole';
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
  // Criar é sempre permitido (não existe papel antes de a história existir); editar respeita
  // o papel real - o botão de editar em StorySelectionScreen não é filtrado por papel, então
  // um colaborador leitor pode abrir esta tela pra uma história de terceiro. Política
  // (tipo / favoritos / exclusão) é só do dono; um writer ainda edita título e conteúdo.
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
          normalizeSceneTiming: false,
          allowReaderComments: false,
          lastOperationLog: 0,
          lastServerSyncedLog: 0,
        };
        await storyService().createStory(userId, storyData);
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

      <Button onPress={handleSave} style={styles.saveButton} disabled={!canEdit}>
        {storyId ? t('update_story') : t('create_story')}
      </Button>

      {storyId && (
        <Button
          onPress={handleDelete}
          style={[styles.saveButton, styles.deleteButton]}
          disabled={!canManageStoryPolicy}
        >
          {t('delete_story_title')}
        </Button>
      )}
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  scrollViewContent: {
    padding: 20,
    flexGrow: 1,
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
    backgroundColor: 'red', // Destructive color
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryFormScreen;
