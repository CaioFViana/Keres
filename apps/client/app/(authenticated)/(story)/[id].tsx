import { StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState } from 'react';
import { Story } from '@keres/shared/src/domain/entities/Story'; // Import the shared Story interface

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams();
  const { apiClient } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && apiClient) {
      const fetchStoryDetails = async () => {
        try {
          setLoading(true);
          const fetchedStory = await apiClient.request<Story>(`/stories/${id}`);
          setStory(fetchedStory);
        } catch (err) {
          console.error('Failed to fetch story details:', err);
          setError('Failed to load story details.');
        } finally {
          setLoading(false);
        }
      };
      fetchStoryDetails();
    }
  }, [id, apiClient]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading story details...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Error</ThemedText>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!story) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Story Not Found</ThemedText>
        <ThemedText>The story with ID {id} could not be loaded.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">{story.title}</ThemedText>
        <ThemedText type="subtitle">ID: {story.id}</ThemedText>

        {story.summary && (
          <ThemedView style={styles.detailRow}>
            <ThemedText type="defaultSemiBold">Summary:</ThemedText>
            <ThemedText>{story.summary}</ThemedText>
          </ThemedView>
        )}

        {story.genre && (
          <ThemedView style={styles.detailRow}>
            <ThemedText type="defaultSemiBold">Genre:</ThemedText>
            <ThemedText>{story.genre}</ThemedText>
          </ThemedView>
        )}

        {story.language && (
          <ThemedView style={styles.detailRow}>
            <ThemedText type="defaultSemiBold">Language:</ThemedText>
            <ThemedText>{story.language}</ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.detailRow}>
          <ThemedText type="defaultSemiBold">Favorite:</ThemedText>
          <ThemedText>{story.isFavorite ? 'Yes' : 'No'}</ThemedText>
        </ThemedView>

        {story.extraNotes && (
          <ThemedView style={styles.detailRow}>
            <ThemedText type="defaultSemiBold">Extra Notes:</ThemedText>
            <ThemedText>{story.extraNotes}</ThemedText>
          </ThemedView>
        )}

        <ThemedText type="defaultSemiBold" style={styles.createdAt}>Created At: {new Date(story.createdAt).toLocaleString()}</ThemedText>
        <ThemedText type="defaultSemiBold">Updated At: {new Date(story.updatedAt).toLocaleString()}</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 5,
  },
  createdAt: {
    marginTop: 20,
  },
});
