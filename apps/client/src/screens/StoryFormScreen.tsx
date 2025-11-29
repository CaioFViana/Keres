import { Story } from '@keres/shared/entities/Story';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../components/common/Button/Button';
import Select from '../components/common/Select/Select';
import TextInput from '../components/common/TextInput/TextInput';
import { useDrizzle } from '../db';
import { createStoryService } from '../services/StoryService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../theme/commonStyles';
import { getLanguageOptions } from '../utils/languageOptions';

type RootStackParamList = {
  StoryForm: { storyId?: string };
  StorySelection: undefined;
};

type StoryFormScreenRouteProp = NativeStackScreenProps<RootStackParamList, 'StoryForm'>['route'];
type StoryFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StoryForm'>;

const StoryFormScreen = () => {
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation<StoryFormScreenNavigationProp>();
  const route = useRoute<StoryFormScreenRouteProp>();
  const { storyId } = route.params || {};
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore(); // Get userId from store

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [description, setDescription] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const backAction = () => {
      navigation.goBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    const loadStory = async () => {
      if (storyId) {
        try {
          setLoading(true);
          const fetchedStory = await storyService().getStoryById(storyId);
          if (fetchedStory) {
            setTitle(fetchedStory.title);
            setType(fetchedStory.type);
            setDescription(fetchedStory.description);
            setGenre(fetchedStory.genre);
            setLanguage(fetchedStory.language);
            setIsFavorite(fetchedStory.isFavorite);
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
  }, [storyId, storyService, t, applyTheme]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), t('title_required'));
      return;
    }

    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified')); // New translation key needed
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storyData: Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'> = {
        userId: userId!, // Include userId here, asserted as non-null
        title: title.trim(),
        type,
        description,
        genre,
        language,
        isFavorite,
        extraNotes,
        theme,
        lastOperationLog: 0,
        lastServerSyncedLog: 0,
      };

      if (storyId) {
        await storyService().updateStory(storyId, storyData);
        Alert.alert(t('success'), t('story_updated_successfully'));
      } else {
        await storyService().createStory(storyData);
        Alert.alert(t('success'), t('story_created_successfully'));
      }
      navigation.goBack(); // Go back to the previous screen (StorySelection)
    } catch (err) {
      console.error('Failed to save story:', err);
      setError(t('failed_to_save_story'));
      Alert.alert(t('error'), t('failed_to_save_story'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
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
                Alert.alert(t('success'), t('story_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete story:', err);
                setError(t('failed_to_delete_story'));
                Alert.alert(t('error'), t('failed_to_delete_story'));
              } finally {
                setLoading(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const storyTypeOptions = [
    { label: t('linear'), value: 'linear' },
    { label: t('branching'), value: 'branching' },
  ];

  const languageOptions = getLanguageOptions(t);

  // Placeholder for theme options - will need to be dynamic later
  const themeOptions = [
    { label: t('default_theme'), value: 'default' },
    { label: t('forest_theme'), value: 'forest' },
    { label: t('ocean_theme'), value: 'ocean' },
  ];

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (error && !storyId) { // Only show error if creating a new story and something went wrong
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{error}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{storyId ? t('edit_story') : t('create_new_story_screen_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {storyId ? t('edit_story_description') : t('create_new_story_screen_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
          <TextInput
            placeholder={t('title_placeholder')}
            value={title}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('type')}</Text>
          <Select
            options={storyTypeOptions}
            value={type}
            onValueChange={(value) => setType(value as 'linear' | 'branching')}
            placeholder={t('select_story_type')}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
          <TextInput
            placeholder={t('description_placeholder')}
            value={description || ""}
            onChangeText={setDescription}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('genre')}</Text>
          <TextInput
            placeholder={t('genre_placeholder')}
            value={genre || ""}
            onChangeText={setGenre}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('language')}</Text>
          <Select
            options={languageOptions}
            value={language}
            onValueChange={setLanguage}
            placeholder={t('select_language')}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('theme')}</Text>
          <Select
            options={themeOptions}
            value={theme}
            onValueChange={(value) => {
              setTheme(value);
              applyTheme(value || 'default');
            }}
            placeholder={t('select_theme')}
          />

          <Button onPress={handleSave} style={styles.saveButton}>
            {storyId ? t('update_story') : t('create_story')}
          </Button>

          {storyId && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_story_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
}; // Last view of 90 size is to avoid a bug that happened with the screen scrolling.

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
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 5,
  },
  saveButton: {
    marginTop: 30,
    marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: 'red', // Destructive color
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryFormScreen;
