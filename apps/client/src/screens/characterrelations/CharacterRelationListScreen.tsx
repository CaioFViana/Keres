import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import CharacterRelationListItem from '../../components/listitem/CharacterRelationListItem';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { CharacterRelationsStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Assuming CharacterRelationsStackParamList exists
import { CharacterRelationWithNames } from '../../services/storymanagement/CharacterRelationService';
import { useCharacterRelationStore } from '../../state/characterRelationStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

export type CharacterRelationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharacterRelationsStack'>,
  NativeStackNavigationProp<CharacterRelationsStackParamList, 'CharacterRelationView'>
>;

const CharacterRelationsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterRelationsScreenNavigationProp>();

  const {
    items: characterRelations,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    setAdvancedSearchCriteria,
  } = useEntityListScreen({
    useStore: useCharacterRelationStore,
    collectionKey: 'characterRelations',
    changeEvent: 'character_relation_changed',
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerButton: {
      marginRight: 15,
    },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('character_relations_title'));
      navigation.getParent()?.setOptions({
        title: t('character_relations_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CharacterRelationView')}
            style={styles.headerButton}
            accessibilityLabel={t('character_relation_map_title')}
          >
            <Ionicons name="git-network-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t, styles.headerButton])
  );

  const memoizedListItem = useCallback(({ item }: { item: CharacterRelationWithNames }) => (
    <CharacterRelationListItem relation={item} />
  ), []);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_relation_type'), value: 'relationType' },
      { label: t('sort_by_character1_name'), value: 'char1Name' },
      { label: t('sort_by_character2_name'), value: 'char2Name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  if (loading && characterRelations.length === 0) {
    return <ScreenLoading message={t('loading_relations')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={characterRelations}
        renderItem={memoizedListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
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
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
      />
    </View>
  );
};

export default CharacterRelationsScreen;