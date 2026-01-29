import { Story } from '@keres/shared/entities/Story';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native'; // Removed BackHandler
import Button from '../../components/common/Button/Button';
import Select from '../../components/common/Select/Select';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler'; // Import useBackButtonHandler
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createServerService } from '../../services/ServerService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { themeDisplayOptions } from '../../theme/palettes'; // Import themeDisplayOptions
import { getLanguageOptions } from '../../utils/i18n';

type StorySettingsScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'MainDashboard'>;

const StorySettingsScreen = () => {
  useBackButtonHandler(); // Call the hook here
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation<StorySettingsScreenNavigationProp>();
  // Removed useRoute and route.params
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const commonContainerStyles = getCommonContainerStyles(colors);

  // Early return if no storyId is available
  if (!storyId) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{t('no_story_selected_for_settings')}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const serverService = useCallback(() => createServerService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [description, setDescription] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null); // New state for serverId
  const [availableServers, setAvailableServers] = useState<ServerSelect[]>([]); // New state for available servers

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStoryAndServers = async () => {
      try {
        setLoading(true);
        // Fetch story
        const fetchedStory = await storyService().getStoryById(storyId);

        if (!fetchedStory) {
          setError(t('story_not_found'));
          return;
        }

        setTitle(fetchedStory.title);
        setType(fetchedStory.type);
        setDescription(fetchedStory.description);
        setGenre(fetchedStory.genre);
        setLanguage(fetchedStory.language);
        setIsFavorite(fetchedStory.isFavorite);
        setExtraNotes(fetchedStory.extraNotes);
        setTheme(fetchedStory.theme);
        applyTheme(fetchedStory.theme || 'default');

        // Fetch servers
        const servers = await serverService().getAllServers();
        setAvailableServers(servers);

        // Check if fetchedStory.serverId exists in availableServers
        if (fetchedStory.serverId) {
          const foundServer = servers.find((server: ServerSelect) => server.id === fetchedStory.serverId); // Typed server
          if (foundServer) {
            setServerId(fetchedStory.serverId);
          } else {
            // Server not found, set story.serverId to null in DB
            await storyService().updateStory(userId!, storyId, { serverId: null });
            setServerId(null);
            Alert.alert(t('warning'), t('server_not_found_for_story'));
          }
        } else {
          setServerId(null);
        }

      } catch (err) {
        console.error('Failed to load story or servers:', err);
        setError(t('failed_to_load_story_settings'));
      } finally {
        setLoading(false);
      }
    };
    loadStoryAndServers();
  }, [storyId, storyService, serverService, userId, t, applyTheme]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), t('title_required'));
      return;
    }

    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storyData: Partial<Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>> = {
        title: title.trim(),
        type,
        description,
        genre,
        language,
        isFavorite,
        extraNotes,
        theme,
        serverId, // Include serverId in update
      };

      await storyService().updateStory(userId, storyId, storyData);
      Alert.alert(t('success'), t('story_updated_successfully'));
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save story settings:', err);
      setError(t('failed_to_save_story_settings'));
      Alert.alert(t('error'), t('failed_to_save_story_settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

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
            try {
              setLoading(true);
              await storyService().deleteStory(userId, storyId);
              Alert.alert(t('success'), t('story_deleted_successfully'));
              navigation.navigate('StorySelection'); // Corrected navigation
            } catch (err) {
              console.error('Failed to delete story:', err);
              setError(t('failed_to_delete_story'));
              Alert.alert(t('error'), t('failed_to_delete_story'));
            } finally {
              setLoading(false);
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

  const themeOptions = themeDisplayOptions.map(theme => ({
    label: t(theme.labelKey),
    value: theme.value,
  }));

  // Server options from available servers
  const serverOptions = availableServers.map(server => ({
    label: server.name,
    value: server.id,
  }));
  // Add an option for "No Server" with empty string value
  serverOptions.unshift({ label: t('no_server'), value: '' });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (error) {
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
          <Text style={[styles.title, { color: colors.text }]}>{t('story_settings_screen_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('story_settings_screen_description')}
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
            disabled={true}
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

          {/* New Server Select Field */}
          <Text style={[styles.label, { color: colors.text }]}>{t('server')}</Text>
          <Select
            options={serverOptions}
            value={serverId === null ? '' : serverId} // Convert null to empty string for Select component
            onValueChange={(value) => setServerId(value === '' ? null : value)} // Convert empty string back to null
            placeholder={t('select_server')}
          />


          <Button onPress={handleSave} style={styles.saveButton}>
            {t('update_story')}
          </Button>

          <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
            {t('delete_story_title')}
          </Button>

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
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

export default StorySettingsScreen;