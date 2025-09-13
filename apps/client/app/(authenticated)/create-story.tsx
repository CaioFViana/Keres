import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';

import SuggestionSelect from '@/components/SuggestionSelect'; // Added this import
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { StoryCreatePayload } from '@keres/shared';
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
            : { width: '90%', alignSelf: 'center', ...styles.contentPaddingSmall } // Constrain, center, and add padding for small screens
        ]}
      >
        <View style={[styles.headerContainer, isLargeScreen && styles.headerContainerLarge]}>
          <ThemedText type="title">Create New Story</ThemedText>
          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
        </View>

        <View style={styles.singleColumnContainer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Title *"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
        </View>

        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <View style={[styles.switchContainer, { flex: 1 }]}>
              <ThemedText style={styles.label}>Story Type: {type === 'linear' ? 'Linear' : 'Branching'}</ThemedText>
              <Switch
                value={type === 'branching'} // True if branching, false if linear
                onValueChange={(value) => setType(value ? 'branching' : 'linear')}
              />
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
          <TextInput
            style={styles.input}
            placeholder="Summary"
            value={summary}
            onChangeText={setSummary}
            multiline
          />
        </View>

        <View style={isLargeScreen ? styles.twoColumnContainer : styles.singleColumnContainer}>
          <View style={isLargeScreen && styles.columnItem}>
            <View style={{ flex: 1 }}>
              <SuggestionSelect
                label="Genre"
                value={genre}
                onChangeText={setGenre}
                placeholder="Genre"
              />
            </View>
          </View>

          <View style={isLargeScreen && styles.columnItem}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Language"
              value={language}
              onChangeText={setLanguage}
            />
          </View>
        </View>

        <View style={styles.singleColumnContainer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Extra Notes"
            value={extraNotes}
            onChangeText={setExtraNotes}
            multiline
          />
        </View>

        <Button title={loading ? "Creating..." : "Create Story"} onPress={handleCreateStory} disabled={loading} />
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
    paddingHorizontal: 10,
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
    marginBottom: 10,
  },
  singleColumnContainer: {
    width: '100%',
    marginBottom: 10,
  },
  columnItem: {
    flex: 1, // Allow items to take up available space
    marginHorizontal: 5, // Add horizontal margin for spacing
    marginBottom: 10, // Spacing between items
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000', // Ensure text is visible
    backgroundColor: '#fff', // Ensure background is visible
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});
