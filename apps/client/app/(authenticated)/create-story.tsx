import React, { useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';

import ModalButton from '@/components/ModalButton';
import SuggestionModal from '@/components/SuggestionModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { StoryCreatePayload, SuggestionResponse } from '@keres/shared';
import { router } from 'expo-router';

export default function CreateStoryScreen() {
  const { apiClient, token, userId } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Define your breakpoint for desktop

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
        setSuggestionError(err.message || 'Failed to fetch types');
      } finally {
        setLoadingSuggestionTypes(false);
      }
    };

    fetchTypes();
  }, [apiClient, token, userId]);

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
        setSuggestionError(err.message || 'Failed to fetch suggestions');
      } finally {
        setLoadingSuggestionsForType(false);
      }
    };

    fetchSuggestions();
  }, [selectedSuggestionType, apiClient, token, userId]);

  const handleCreateStory = async () => {
    if (!apiClient || !token || !userId) {
      setError('Authentication required.');
      return;
    }

    if (!title.trim()) {
      setError('Title cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);

    const newStory: StoryCreatePayload = {
      userId: userId,
      title: title,
      type: type,
      summary: summary || undefined,
      genre: genre || undefined,
      language: language || undefined,
      isFavorite: isFavorite,
      extraNotes: extraNotes || undefined,
    };

    try {
      const response = await apiClient.request<StoryCreatePayload>('/stories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newStory),
      });
      router.replace('/(authenticated)/dashboard'); // Navigate back to dashboard
    } catch (err: any) {
      console.error('Failed to create story:', err);
      setError(err.message || 'Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.fullWidthScrollView} // New style to ensure ScrollView takes full width
        contentContainerStyle={[
          styles.scrollContainer, // flexGrow: 1, paddingBottom: 20
          isLargeScreen
            ? { width: '80%', alignSelf: 'center', ...styles.contentPaddingLarge } // Constrain, center, and add padding for large screens
            : { width: '90%', alignSelf: 'center' } // Constrain and center for small screens (padding handled by columnItem)
        ]}
      >
        <View style={[styles.headerContainer, isLargeScreen && styles.headerContainerLarge]}>
          <ThemedText type="title">Create New Story</ThemedText>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>Title *:</ThemedText>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Enter Title"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
        </View>
        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <ThemedText style={styles.label}>Story Type:</ThemedText>
            <View style={styles.typeToggleButtonContainer}>
              <Pressable
                style={[styles.typeToggleButton, type === 'linear' && styles.typeToggleButtonActive]}
                onPress={() => setType('linear')}
              >
                <ThemedText style={[styles.typeToggleButtonText, type === 'linear' && styles.typeToggleButtonTextActive]}>Linear</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.typeToggleButton, type === 'branching' && styles.typeToggleButtonActive]}
                onPress={() => setType('branching')}
              >
                <ThemedText style={[styles.typeToggleButtonText, type === 'branching' && styles.typeToggleButtonTextActive]}>Branching</ThemedText>
              </Pressable>
            </View>
          </View>
                    <View style={isLargeScreen && styles.columnItem}>
            <View style={[styles.switchContainer, { flex: 1 }]}>
              <ThemedText style={styles.label}>Favorite:</ThemedText>
              <Switch
                value={isFavorite}
                onValueChange={setIsFavorite}
              />
            </View>
          </View>
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>Summary:</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter Summary"
            value={summary}
            onChangeText={setSummary}
            multiline
          />
        </View>
        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <ThemedText style={styles.label}>Genre:</ThemedText>
            <View style={styles.genreInputContainer}>
              <TextInput
                style={[styles.input, styles.genreTextInput]}
                placeholder="Enter Genre"
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
            <ThemedText style={styles.label}>Language:</ThemedText>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter Language"
              value={language}
              onChangeText={setLanguage}
            />
          </View>
        </View>
        <View style={styles.singleColumnContainer}>
          <ThemedText style={styles.label}>Extra Notes:</ThemedText>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Add any extra notes"
            value={extraNotes}
            onChangeText={setExtraNotes}
            multiline
          />
        </View>
        <Button title={loading ? "Creating..." : "Create Story"} onPress={handleCreateStory} disabled={loading} />
        <SuggestionModal
          isVisible={showGenreModal}
          onClose={() => setShowGenreModal(false)}
          onSelect={(selectedValue) => {
            setGenre(selectedValue);
            setShowGenreModal(false);
          }}
          label1="Suggestion Type"
          options1={suggestionTypes.map(type => ({ label: type, value: type }))}
          value1={selectedSuggestionType}
          onChange1={setSelectedSuggestionType}
          label2="Suggestion"
          options2={suggestionsForType}
          value2={genre} // Use genre as the selected value for the second picker
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
    alignItems: 'center', // Center content horizontally in the container
  },
    fullWidthScrollView: {
    flex: 1, // Allow ScrollView to take available vertical space
    width: '100%', // Ensure ScrollView takes full horizontal space
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Add some padding at the bottom for scrollable content
  },
  contentPaddingLarge: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  contentPaddingSmall: {
    paddingHorizontal: 20, // Increased to match container padding
    paddingVertical: 10,
  },
  scrollContentContainerLarge: {
    // Removed alignItems: 'center' to allow content to align to start
  },
  headerContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContainerLarge: {
    alignItems: 'center', // Center title on large screens
  },
  twoColumnContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10, // Reverted
  },
  singleColumnContainer: {
    width: '100%',
    marginBottom: 10, // Reverted
  },
  columnItem: {
    flex: 1, // Allow items to take up available space
    //marginHorizontal: 5, // Removed to allow content to go to edges
    marginBottom: 10, // Reverted
    //paddingHorizontal: 20, // Add horizontal padding to columnItem itself
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000', // Ensure text is visible
    backgroundColor: '#fff', // Ensure background is visible
  },
  genreInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Allow it to take up available space in columnItem
  },
  genreTextInput: {
    flex: 1, // Allow TextInput to take up available space
    marginRight: 10, // Space between input and button
  },
  suggestionButton: {
    borderRadius: 5, // Match input border radius
    padding: 10,
    backgroundColor: '#e0e0e0', // A neutral background color
    elevation: 1,
    marginRight: 10
  },
  suggestionButtonText: {
    color: '#333', // A neutral text color
    fontWeight: 'bold',
    fontSize: 18, // Make icon visible
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8, // Increased click area
    paddingHorizontal: 8, // Increased click area
  },
  typeToggleButtonContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 10,
    borderRadius: 5,
    overflow: 'hidden', // Ensures children respect border radius
    borderWidth: 1,
    borderColor: '#ccc',
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0', // Default background
  },
  typeToggleButtonActive: {
    backgroundColor: '#007bff', // Active background
  },
  typeToggleButtonText: {
    color: '#333', // Default text color
    fontWeight: 'normal',
  },
  typeToggleButtonTextActive: {
    color: 'white', // Active text color
    fontWeight: 'bold',
  },
  label: {
    // alignSelf: 'flex-start', // Removed to allow parent alignItems to work
    // marginTop: 10,
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});
