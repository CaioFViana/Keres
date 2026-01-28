import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // Added useState
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import CharacterRelationListItem from '../../components/listitem/CharacterRelationListItem';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { CharacterRelationsStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Assuming CharacterRelationsStackParamList exists
import { CharacterRelationWithNames } from '../../services/CharacterRelationService';
import { useCharacterRelationStore } from '../../state/characterRelationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type CharacterRelationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharacterRelationsStack'>,
  NativeStackNavigationProp<CharacterRelationsStackParamList, 'CharacterRelationDetail'>
>;

const CharacterRelationsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<CharacterRelationsScreenNavigationProp>();

  const {
    characterRelations,
    searchTerm: storeSearchTerm, // Renamed to avoid collision with local state
    loading,
    error,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    fetchCharacterRelations,
    setSearchTerm: setStoreSearchTerm, // Renamed to avoid collision with local state
    setDbAndStoryId,
    initializeService,
    setSort,
    setAdvancedSearchCriteria,
  } = useCharacterRelationStore();

  const [searchQuery, setSearchQuery] = useState(storeSearchTerm); // Local state for immediate input feedback

  // Synchronize local searchQuery with storeSearchTerm if storeSearchTerm changes externally
  useEffect(() => {
    if (storeSearchTerm !== searchQuery) {
      setSearchQuery(storeSearchTerm);
    }
  }, [storeSearchTerm]); // Only react to storeSearchTerm changes

  const debouncedSetStoreSearchTerm = useMemo(
    () => debounce((term: string) => setStoreSearchTerm(term), 1000), // Debounce for 1000ms
    [setStoreSearchTerm]
  );

  // Debounce the update to the store's searchTerm
  useEffect(() => {
    debouncedSetStoreSearchTerm(searchQuery);

    return () => {
      debouncedSetStoreSearchTerm.cancel && debouncedSetStoreSearchTerm.cancel();
    };
  }, [searchQuery, debouncedSetStoreSearchTerm]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService]);

  // Effect to trigger fetch when storeSearchTerm changes (after debounce)
  // or when other filter/sort criteria change (immediately via store setters)
  useEffect(() => {
    fetchCharacterRelations();
  }, [storeSearchTerm, activeSort, sortDirection, advancedSearchCriteria, fetchCharacterRelations]);

  useEffect(() => {
    const handleCharacterRelationChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchCharacterRelations(); // Call the immediate fetchCharacterRelations
      }
    };

    entityEventEmitter.on('character_relation_changed', handleCharacterRelationChange);

    return () => {
      entityEventEmitter.off('character_relation_changed', handleCharacterRelationChange);
    };
  }, [selectedStory?.id, fetchCharacterRelations]);

  // Listen for reset event
  useEffect(() => {
    const handleReset = () => {
      // Only pop to top if there's more than one screen in the stack
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };

    entityEventEmitter.on('character_relation_navigation_reset', handleReset);

    return () => {
      entityEventEmitter.off('character_relation_navigation_reset', handleReset);
    };
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('character_relations_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CharacterRelationForm', { characterRelationId: undefined })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleViewDetails = useCallback((relationId: string) => {
    navigation.navigate('CharacterRelationDetail', { relationId });
  }, [navigation]);

  const memoizedListItem = useCallback(({ item }: { item: CharacterRelationWithNames }) => (
    <CharacterRelationListItem relation={item} onViewDetails={handleViewDetails} />
  ), [handleViewDetails]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_relation_type'), value: 'relationType' },
      { label: t('sort_by_character1_name'), value: 'char1Name' },
      { label: t('sort_by_character2_name'), value: 'char2Name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  const handleSearch = useCallback((term: string) => {
    setSearchQuery(term); // Update local state immediately
  }, [setSearchQuery]);

  const handleSortChange = useCallback((sortBy: string | null) => {
    setSort(sortBy, sortDirection);
  }, [setSort, sortDirection]);

  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setSort(activeSort, direction);
  }, [setSort, activeSort]);

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
        <Text style={styles.detailText}>{t('loading_relations')}</Text>
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
        data={characterRelations}
        renderItem={memoizedListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_relations')}
        currentSearchTerm={searchQuery} // Display local state for responsive input
        filterOptions={[]} // No tag filtering
        onFilterChange={() => {}} // No tag filtering
        selectedFilterValues={[]} // No tag filtering
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        // onFavoriteFilterChange is not needed as CharacterRelations don't have favorite status
        // currentFavoriteFilterState is not needed
        disableTagFilter={true}
        disableFavoriteFilter={true} // Disable favorite filter
        entityName="CharacterRelation"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
    </View>
  );
};

export default CharacterRelationsScreen;