import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawerScreenProps } from '@react-navigation/drawer'; // Correct import
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import TagListItem from '../components/tag/TagListItem';
import GenericFilterSortList from '../components/common/GenericFilterSortList/GenericFilterSortList';
import { useDrizzle } from '../db';
import { MainSystemDrawerParamList } from '../navigation/MainSystemStack'; // Correct import
import { useStoryStore } from '../state/storyStore';
import { useTagStore } from '../state/tagStore';
import { useTheme } from '../theme';
import { debounce } from '../utils/debounce';
import { TagSelect } from '../db/schemas/tags'; // Import TagSelect

type TagsScreenProps = DrawerScreenProps<MainSystemDrawerParamList, 'Tags'>; // Correct type

const TagsScreen: React.FC<TagsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();

  const {
    tags,
    searchTerm,
    loading,
    error,
    fetchTags,
    setSearchTerm,
    setDbAndStoryId,
    initializeService,
  } = useTagStore();

  // Debounce the fetchTags call
  const debouncedFetchTags = useMemo(
    () => debounce(() => fetchTags()),
    [fetchTags]
  );

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      // Initial fetch is now handled by the debounced effect below, no need to call here
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService]);

  useEffect(() => {
    // This effect runs whenever searchTerm changes, but fetchTags is debounced
    debouncedFetchTags();
    return () => {
      // Cleanup for debounce
      debouncedFetchTags.cancel && debouncedFetchTags.cancel();
    };
  }, [searchTerm, debouncedFetchTags]);

  const handleViewDetails = useCallback((tagId: string) => {
    // Implement navigation to TagDetailScreen if needed
    // navigation.navigate('TagDetail', { tagId });
    console.log('View Tag Details:', tagId);
  }, []);

  const memoizedTagListItem = useCallback(({ item }: { item: TagSelect }) => (
    <TagListItem tag={item} onViewDetails={handleViewDetails} />
  ), [handleViewDetails]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, [setSearchTerm]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    errorText: {
      color: colors.error,
    },
    buttonContainer: {
      marginTop: 20,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_tags')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={tags}
        renderItem={memoizedTagListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_tags')}
        currentSearchTerm={searchTerm}
        onFilterChange={() => {}} // Dummy function as per requirement to disable filtering
        selectedFilterValues={[]} // Empty array as per requirement to disable filtering
        onSortChange={() => {}} // Dummy function as per requirement to disable sorting
        onSortDirectionChange={() => {}} // Dummy function as per requirement to disable sorting
        currentSortDirection={'asc'} // Default value as per requirement to disable sorting
      />
    </View>
  );
};

export default TagsScreen;
