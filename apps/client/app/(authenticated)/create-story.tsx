import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, ScrollView, Switch, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { StoryCreatePayload } from '@keres/shared';

export default function CreateStoryScreen() {
  const { apiClient, token, userId } = useAuth();

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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedText type="title">Create New Story</ThemedText>

        {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

        <TextInput
          style={styles.input}
          placeholder="Title *"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="words"
        />

        <ThemedText style={styles.label}>Story Type:</ThemedText>
        <Picker
          selectedValue={type}
          onValueChange={(itemValue) => setType(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Linear" value="linear" />
          <Picker.Item label="Branching" value="branching" />
        </Picker>

        <TextInput
          style={styles.input}
          placeholder="Summary"
          value={summary}
          onChangeText={setSummary}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="Genre"
          value={genre}
          onChangeText={setGenre}
        />

        <TextInput
          style={styles.input}
          placeholder="Language"
          value={language}
          onChangeText={setLanguage}
        />

        <View style={styles.switchContainer}>
          <ThemedText style={styles.label}>Favorite:</ThemedText>
          <Switch
            value={isFavorite}
            onValueChange={setIsFavorite}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Extra Notes"
          value={extraNotes}
          onChangeText={setExtraNotes}
          multiline
        />

        <Button title={loading ? "Creating..." : "Create Story"} onPress={handleCreateStory} disabled={loading} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000', // Ensure text is visible
    backgroundColor: '#fff', // Ensure background is visible
  },
  picker: {
    width: '100%',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  label: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});
