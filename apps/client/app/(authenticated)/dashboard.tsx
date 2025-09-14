import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { StoryResponse } from '@keres/shared';
import { Link, router } from 'expo-router';
import { setLanguage } from '../../utils/storage';
import PickerSelect from '../../components/PickerSelect';

export default function DashboardScreen() {
  const { signOut, apiClient, token, isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const buttonBackgroundColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const storyItemBackgroundColor = useThemeColor({}, 'cardBackground');
  const editButtonColor = useThemeColor({}, 'editButton');
  const deleteButtonColor = useThemeColor({}, 'deleteButton');

  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ];

  const handleLanguageChange = useCallback(async (lang: string) => {
    setSelectedLanguage(lang);
    await i18n.changeLanguage(lang);
    await setLanguage(lang);
  }, [i18n]);

  const fetchStories = useCallback(async () => {
    if (!isAuthenticated || !apiClient || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.request<{ items: StoryResponse[]; totalItems: number }>(
        '/stories/all',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setStories(response.items);
    } catch (err: any) {
      console.error('Failed to fetch stories:', err);
      setError(err.message || 'Failed to fetch stories');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, apiClient, token]);

  useEffect(() => {
    if (hasFetched.current) {
      return; // Prevent re-fetching on subsequent renders/strict mode double invocation
    }
    hasFetched.current = true; // Mark as fetched to prevent future calls
    fetchStories();
  }, [fetchStories]);

  const handleDeleteStory = useCallback(async (storyId: string) => {
    Alert.alert(
      t('dashboard.confirmDeleteTitle'),
      t('dashboard.confirmDeleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          onPress: async () => {
            if (!apiClient || !token) {
              setError(t('common.authRequired'));
              return;
            }
            try {
              await apiClient.request(`/stories/${storyId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              fetchStories(); // Re-fetch stories after deletion
            } catch (err: any) {
              console.error('Failed to delete story:', err);
              setError(err.message || t('dashboard.failedToDeleteStory'));
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  }, [apiClient, token, fetchStories, t]);

  const renderStoryItem = useCallback(({ item }: { item: StoryResponse }) => (
    <View style={{
      padding: 15,
      marginVertical: 5,
      borderRadius: 5,
      width: '100%',
      backgroundColor: storyItemBackgroundColor,
    }}>
      <Link href={{ pathname: "/(authenticated)/(story)/[id]", params: { id: item.id } }} asChild>
        <TouchableOpacity style={{ flex: 1 }}>
          <ThemedText type="subtitle">{item.title}</ThemedText>
          <ThemedText style={{ fontSize: 14, marginTop: 5 }}>{t('common.type')}: {item.type}</ThemedText>
          {item.genre && <ThemedText style={{ fontSize: 14 }}>{t('common.genre')}: {item.genre}</ThemedText>}
          {item.isFavorite && <ThemedText style={{ fontSize: 14, color: 'gold' }}>{t('common.favorite')}</ThemedText>}
        </TouchableOpacity>
      </Link>
      <View style={styles.storyItemButtonsContainer}>
        <TouchableOpacity
          style={[styles.storyItemButton, { backgroundColor: editButtonColor }]} // Use editButtonColor
          onPress={() => router.push(`/(authenticated)/edit-story/${item.id}`)}
        >
          <ThemedText style={{ color: buttonTextColor }}>{t('common.edit')}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.storyItemButton, { backgroundColor: deleteButtonColor }]} // Use deleteButtonColor
          onPress={() => handleDeleteStory(item.id)}
        >
          <ThemedText style={{ color: buttonTextColor }}>{t('common.delete')}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  ), [storyItemBackgroundColor, buttonTextColor, editButtonColor, deleteButtonColor, handleDeleteStory, t]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('dashboard.welcomeMessage')}</ThemedText>

      <PickerSelect
        selectedValue={selectedLanguage}
        onValueChange={handleLanguageChange}
        options={languageOptions}
        placeholder={{ label: t('dashboard.selectLanguage'), value: null }}
      />

      <TouchableOpacity style={[styles.button, { backgroundColor: buttonBackgroundColor }]} onPress={() => router.push('/(authenticated)/create-story')}>
        <ThemedText style={{ color: buttonTextColor }}>{t('dashboard.createNewStory')}</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={[styles.button, { backgroundColor: buttonBackgroundColor }]}>
        <ThemedText style={{ color: buttonTextColor }}>{t('dashboard.logout')}</ThemedText>
      </TouchableOpacity>

      <ThemedText type="subtitle" style={styles.sectionTitle}>{t('dashboard.yourStories')}:</ThemedText>
      {loading && <ThemedText>{t('dashboard.loadingStories')}</ThemedText>}
      {error && <ThemedText style={{ color: 'red' }}>{t('dashboard.error')}: {error}</ThemedText>}
      {!loading && !error && stories.length === 0 && (
        <ThemedText>{t('dashboard.noStoriesFound')}</ThemedText>
      )}
      {!loading && !error && stories.length > 0 && (
        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id}
          style={styles.storyList}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  button: {
    marginTop: 15,
    padding: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 10,
  },
  storyListPlaceholder: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 20,
    minHeight: 100,
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyList: {
    width: '100%',
    marginTop: 10,
  },
  storyItemButtonsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-around',
  },
  storyItemButton: {
    padding: 8,
    borderRadius: 5,
    marginHorizontal: 5,
    flex: 1,
    alignItems: 'center',
  },
});
