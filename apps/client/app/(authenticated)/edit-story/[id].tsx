import React, { useCallback, useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';

import ModalButton from '@/components/ModalButton';
import SuggestionModal from '@/components/SuggestionModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { StoryUpdatePayload, SuggestionResponse, StoryResponse } from '@keres/shared';

export default function EditStoryScreen() {
  const { apiClient, token, userId } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Define your breakpoint for desktop
  const { id } = useLocalSearchParams();
  const storyId = typeof id === 'string' ? id : id?.[0];

  const [initialLoading, setInitialLoading] = useState(true);
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [summary, setSummary] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for Genre Suggestion Modal
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [suggestionTypes, setSuggestionTypes] = useState<string[]>([]);
  const [selectedSuggestionType, setSelectedSuggestionType] = useState<string>('');
  const [suggestionsForType, setSuggestionsForType] = useState<{ label: string; value: string }[]>([]);
  const [loadingSuggestionTypes, setLoadingSuggestionTypes] = useState(true);
  const [loadingSuggestionsForType, setLoadingSuggestionsForType] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Fetch story details on component mount
  useEffect(() => {
    const fetchStoryDetails = async () => {
      if (!apiClient || !token || !storyId) {
        setInitialLoading(false);
        setError(t('common.authRequired'));
        return;
      }

      try {
        setInitialLoading(true);
        const response = await apiClient.request<StoryResponse>(`/stories/${storyId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStory(response);
        setTitle(response.title);
        setType(response.type || 'linear');
        setSummary(response.summary || '');
        setGenre(response.genre || '');
        setLanguage(response.language || '');
        setIsFavorite(response.isFavorite || false);
        setExtraNotes(response.extraNotes || '');
      } catch (err: any) {
        console.error('Failed to fetch story details:', err);
        setError(err.message || t('editStoryScreen.failedToLoadStory'));
      } finally {
        setInitialLoading(false);
      }
    };

    fetchStoryDetails();
  }, [apiClient, token, storyId, t]);

  // Fetch unique suggestion types on component mount for the modal
  useEffect(() => {
    const fetchTypes = async () => {
      if (!apiClient || !token || !userId) {
        setLoadingSuggestionTypes(false);
        return;
      }

      try {
        setLoadingSuggestionTypes(true);
        setSuggestionError(null);
        const response = await apiClient.request<string[]>('/suggestions/types', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setSuggestionTypes(response);
        if (response.length > 0) {
          setSelectedSuggestionType(response[0]); // Select the first type by default
        }
      } catch (err: any) {
        console.error('Failed to fetch suggestion types for modal:', err);
        setSuggestionError(err.message || t('createStoryScreen.suggestionModal.failedToFetchTypes'));
      } finally {
        setLoadingSuggestionTypes(false);
      }
    };

    fetchTypes();
  }, [apiClient, token, userId, t]);

  // Fetch suggestions for the selected type for the modal
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!selectedSuggestionType || selectedSuggestionType === '' || !apiClient || !token || !userId) {
        setSuggestionsForType([]);
        setLoadingSuggestionsForType(false);
        return;
      }

      try {
        setLoadingSuggestionsForType(true);
        setSuggestionError(null);
        const response = await apiClient.request<{ items: SuggestionResponse[]; totalItems: number }>(
          `/suggestions/user/${userId}/type/${selectedSuggestionType}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setSuggestionsForType(response.items.map(item => ({ label: item.value, value: item.value })));
      } catch (err: any) {
        console.error(`Failed to fetch suggestions for type ${selectedSuggestionType} for modal:`, err);
        setSuggestionError(err.message || t('createStoryScreen.suggestionModal.failedToFetchSuggestions'));
      } finally {
        setLoadingSuggestionsForType(false);
      }
    };

    fetchSuggestions();
  }, [selectedSuggestionType, apiClient, token, userId, t]);

  const handleUpdateStory = async () => {
    if (!apiClient || !token || !storyId) {
      setError(t('common.authRequired'));
      return;
    }

    if (!title.trim()) {
      setError(t('createStoryScreen.titleEmptyError'));
      return;
    }

    setLoading(true);
    setError(null);

    const updatedStory: StoryUpdatePayload = {
      title: title,
      type: type,
      summary: summary || undefined,
      genre: genre || undefined,
      language: language || undefined,
      isFavorite: isFavorite,
      extraNotes: extraNotes || undefined,
    };

    try {
      await apiClient.request(`/stories/${storyId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedStory),
      });
      router.replace('/(authenticated)/dashboard'); // Navigate back to dashboard
    } catch (err: any) {
      console.error('Failed to update story:', err);
      setError(err.message || t('editStoryScreen.failedToUpdateStory'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>{t('editStoryScreen.loadingStoryDetails')}</ThemedText>
      </ThemedView>
    );
  }

  if (error && !story) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={{ color: 'red' }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.fullWidthScrollView}
        contentContainerStyle={[
          styles.scrollContainer,
          isLargeScreen
            ? { width: '80%', alignSelf: 'center', ...styles.contentPaddingLarge }
            : { width: '90%', alignSelf: 'center' }
        ]}
      >
        <View style={[styles.headerContainer, isLargeScreen && styles.headerContainerLarge]}>
          <ThemedText type="title">{t('editStoryScreen.title')}</ThemedText>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>{t('createStoryScreen.titleLabel')}</ThemedText>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('createStoryScreen.enterTitlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
        </View>
        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <ThemedText style={styles.label}>{t('createStoryScreen.storyTypeLabel')}</ThemedText>
            <View style={styles.typeToggleButtonContainer}>
              <Pressable
                style={[styles.typeToggleButton, type === 'linear' && styles.typeToggleButtonActive]}
                onPress={() => setType('linear')}
              >
                <ThemedText style={[styles.typeToggleButtonText, type === 'linear' && styles.typeToggleButtonTextActive]}>{t('createStoryScreen.linearType')}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.typeToggleButton, type === 'branching' && styles.typeToggleButtonActive]}
                onPress={() => setType('branching')}
              >
                <ThemedText style={[styles.typeToggleButtonText, type === 'branching' && styles.typeToggleButtonTextActive]}>{t('createStoryScreen.branchingType')}</ThemedText>
              </Pressable>
            </View>
          </View>
          <View style={isLargeScreen && styles.columnItem}>
            <View style={[styles.switchContainer, { flex: 1 }]}>
              <ThemedText style={styles.label}>{t('createStoryScreen.favoriteLabel')}</ThemedText>
              <Switch
                value={isFavorite}
                onValueChange={setIsFavorite}
              />
            </View>
          </View>
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>{t('createStoryScreen.summaryLabel')}</ThemedText>
          <TextInput
            style={styles.input}
            placeholder={t('createStoryScreen.enterSummaryPlaceholder')}
            value={summary}
            onChangeText={setSummary}
            multiline
          />
        </View>
        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <ThemedText style={styles.label}>{t('createStoryScreen.genreLabel')}</ThemedText>
            <View style={styles.genreInputContainer}>
              <TextInput
                style={[styles.input, styles.genreTextInput]}
                placeholder={t('createStoryScreen.enterGenrePlaceholder')}
                value={genre}
                onChangeText={setGenre}
                autoCapitalize="words"
              />
              <ModalButton
                title="💡"
                onPress={() => setShowGenreModal(true)}
                buttonStyle={styles.suggestionButton}
                textStyle={styles.suggestionButtonText}
              />
            </View>
          </View>
          <View style={isLargeScreen && styles.columnItem}>
            <ThemedText style={styles.label}>{t('createStoryScreen.languageLabel')}</ThemedText>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('createStoryScreen.enterLanguagePlaceholder')}
              value={language}
              onChangeText={setLanguage}
            />
          </View>
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>{t('createStoryScreen.extraNotesLabel')}</ThemedText>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('createStoryScreen.addExtraNotesPlaceholder')}
            value={extraNotes}
            onChangeText={setExtraNotes}
            multiline
          />
        </View>
        <Button title={loading ? t('editStoryScreen.updatingStoryButton') : t('editStoryScreen.updateStoryButton')} onPress={handleUpdateStory} disabled={loading} />
        <SuggestionModal
          isVisible={showGenreModal}
          onClose={() => setShowGenreModal(false)}
          onSelect={(selectedValue) => {
            setGenre(selectedValue);
            setShowGenreModal(false);
          }}
          label1={t('createStoryScreen.suggestionModal.typeLabel')}
          options1={suggestionTypes.map(type => ({ label: type, value: type }))}
          value1={selectedSuggestionType}
          onChange1={setSelectedSuggestionType}
          label2={t('createStoryScreen.suggestionModal.suggestionLabel')}
          options2={suggestionsForType}
          value2={genre}
          onChange2={(val) => {
            // This onChange2 is primarily for internal modal state,
            // the onSelect prop handles updating the form's genre state
          }}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  fullWidthScrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  contentPaddingLarge: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  contentPaddingSmall: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContainerLarge: {
    alignItems: 'center',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  singleColumnContainer: {
    width: '100%',
    marginBottom: 10,
  },
  columnItem: {
    flex: 1,
    marginBottom: 10,
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000',
    backgroundColor: '#fff',
  },
  genreInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  genreTextInput: {
    flex: 1,
    marginRight: 10,
  },
  suggestionButton: {
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#e0e0e0',
    elevation: 1,
    marginRight: 10
  },
  suggestionButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 18,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  typeToggleButtonContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 10,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  typeToggleButtonActive: {
    backgroundColor: '#007bff',
  },
  typeToggleButtonText: {
    color: '#333',
    fontWeight: 'normal',
  },
  typeToggleButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  label: {
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});