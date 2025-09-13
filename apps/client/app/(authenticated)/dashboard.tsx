import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { StoryResponse } from '@keres/shared';
import { Link } from 'expo-router';

export default function DashboardScreen() {
  const { signOut, apiClient, token, isAuthenticated } = useAuth();
  const buttonBackgroundColor = useThemeColor({}, 'tint');

  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
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
    };

    fetchStories();
  }, [isAuthenticated, apiClient, token]);

  const renderStoryItem = ({ item }: { item: StoryResponse }) => (
    <Link href={{ pathname: "/(authenticated)/(story)/[id]", params: { id: item.id } }} asChild>
      <TouchableOpacity style={styles.storyItem}>
        <ThemedText>{item.title}</ThemedText>
      </TouchableOpacity>
    </Link>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Welcome to your Dashboard!</ThemedText>

      <TouchableOpacity style={[styles.button, { backgroundColor: buttonBackgroundColor }]} onPress={() => console.log('Create new Story pressed')}>
        <ThemedText>Create new Story</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={[styles.button, { backgroundColor: buttonBackgroundColor }]}>
        <ThemedText>Log out</ThemedText>
      </TouchableOpacity>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Your Stories:</ThemedText>
      {loading && <ThemedText>Loading stories...</ThemedText>}
      {error && <ThemedText style={{ color: 'red' }}>Error: {error}</ThemedText>}
      {!loading && !error && stories.length === 0 && (
        <ThemedText>No stories found. Create one!</ThemedText>
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
  storyItem: {
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    width: '100%',
  },
});
