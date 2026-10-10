import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { entityFieldMetadata, STORY_SCHEMA_ENTITY_TYPES } from '@keres/shared';
import GuideAnchor from '../../../../guides/GuideAnchor';
import { useTheme } from '../../../../theme';
import { countActiveCriteria, withoutCriterion } from '../../../../utils/advancedSearchCriteria';
import AdvancedSearchModal from '@/src/components/common/modals/AdvancedSearchModal/AdvancedSearchModal';
import type { AdvancedSearchScope } from '@/src/components/common/modals/AdvancedSearchModal/AdvancedSearchModal';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { AdvancedSearchCriteria, FavoriteFilterState } from '../../../../types/entityFilters';
import ActiveFilterChips from './ActiveFilterChips';
import { GuidedEmptyState, NoResultsState } from './ListEmptyStates';
import type { GuidedEmptyStateAction } from './ListEmptyStates';
import ListSearchField from './ListSearchField';
import FavoriteFilterButton from '@/src/components/common/controls/FavoriteFilterButton/FavoriteFilterButton';
import { FiltersButton, SortDirectionButton } from './ListToolbarButtons';
import { SearchHighlightContext } from '../SearchHighlight/SearchHighlight';

export type { GuidedEmptyStateAction } from './ListEmptyStates';

/** Wide enough for search, tags, sort and the buttons to share one row. */
const WIDE_TOOLBAR_MIN_WIDTH = 760;

interface GenericFilterSortListProps<T> {
  data: T[];
  renderItem: ({ item }: { item: T }) => React.ReactElement;
  keyExtractor: (item: T) => string;
  // Search Props
  onSearch: (searchText: string) => void;
  /**
   * Enter (web) / the mobile keyboard's return key: commits the search immediately and blurs.
   * Receives the term to commit when it differs from what the list last heard (clearing the box).
   */
  onSearchSubmit?: (term?: string) => void;
  searchPlaceholder?: string;
  currentSearchTerm?: string;
  // Filter Props
  filterComponent?: React.ReactNode;
  filterOptions?: { label: string; value: string; color?: string | null }[];
  /** What the filter is by, when it is not tags (the gallery filters by media type). */
  filterPlaceholder?: string;
  onFilterChange: (filterValues: string[]) => void;
  selectedFilterValues: string[];
  // Sort Props
  sortOptions?: { label: string; value: string }[];
  onSortChange: (sortValue: string | null) => void;
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  currentSortDirection: 'asc' | 'desc';
  currentSortValue?: string | null;
  emptyListComponent?: React.ReactElement;
  /**
   * Guided empty state: a title, a hint and up to two actions ("Create X", ...). An explicit
   * `emptyListComponent` still wins; without either, the legacy plain text shows. While a search
   * or a filter is narrowing the list, "no results" with a way to clear them shows instead.
   */
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  emptyStateActions?: GuidedEmptyStateAction[];
  // Favorite Filter Props
  onFavoriteFilterChange?: (state: FavoriteFilterState) => void;
  currentFavoriteFilterState?: FavoriteFilterState;
  disableFavoriteFilter?: boolean;
  // Advanced Search Props
  entityName?: string;
  storyId?: string;
  onAdvancedSearch?: (criteria: AdvancedSearchCriteria) => void;
  /** Rows the list would hold with given field filters; the filters dialog shows it on its apply button. */
  onPreviewCount?: (criteria: AdvancedSearchCriteria) => Promise<number>;
  currentAdvancedSearchCriteria?: AdvancedSearchCriteria;
  advancedSearchScopes?: AdvancedSearchScope[];
  disableTagFilter?: boolean;
  isLoading?: boolean;
  /** Contextual count supplied by composite lists, e.g. items nested under each result. */
  resultsMeta?: string;
  /** Shown under the results count: what the search found beyond the list's scope, say. */
  resultsNotice?: React.ReactNode;
  /**
   * The list's columns. The gallery shows thumbnails in a grid; the other screens are single-column
   * lists and pass nothing.
   */
  numColumns?: number;
  columnWrapperStyle?: StyleProp<ViewStyle>;
  /**
   * The width of the list's content, which is the list's own width less a scrollbar that takes room
   * from it. The gallery sizes its tiles with it.
   */
  onContentWidthChange?: (width: number) => void;
}

const GenericFilterSortList = <T,>({
  data,
  renderItem,
  keyExtractor,
  onSearch,
  onSearchSubmit,
  searchPlaceholder,
  currentSearchTerm,
  filterComponent,
  filterOptions,
  filterPlaceholder,
  onFilterChange,
  selectedFilterValues,
  sortOptions,
  onSortChange,
  onSortDirectionChange,
  currentSortDirection,
  currentSortValue,
  emptyListComponent,
  emptyStateTitle,
  emptyStateMessage,
  emptyStateActions,
  onFavoriteFilterChange,
  currentFavoriteFilterState,
  entityName,
  storyId,
  onAdvancedSearch,
  onPreviewCount,
  currentAdvancedSearchCriteria,
  advancedSearchScopes,
  disableFavoriteFilter = false,
  disableTagFilter = false,
  isLoading = false,
  resultsMeta,
  resultsNotice,
  numColumns = 1,
  columnWrapperStyle,
  onContentWidthChange,
}: GenericFilterSortListProps<T>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [selectedSort, setSelectedSort] = useState<string | null>(currentSortValue || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(currentSortDirection);
  const [selectedFilter, setSelectedFilter] = useState<string[]>(selectedFilterValues || []);
  const [internalFavoriteFilterState, setInternalFavoriteFilterState] =
    useState<FavoriteFilterState>(currentFavoriteFilterState || 'all');
  const [isAdvancedSearchModalVisible, setIsAdvancedSearchModalVisible] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const isWide = toolbarWidth >= WIDE_TOOLBAR_MIN_WIDTH;

  // Calculate if there are any searchable fields for the current entity - either native
  // (static registry) or, for entity types that support Story Schema custom attributes, the
  // possibility of one existing (or being added later) is enough to keep the button live
  // instead of needing a separate story-scoped fetch just to decide visibility.
  const hasAdvancedSearchFields = useMemo(() => {
    if (!entityName) return false;
    const entities = advancedSearchScopes?.map((scope) => scope.entityName) ?? [entityName];
    const hasNativeSearchableFields = entities.some((name) =>
      entityFieldMetadata[name]?.some((field) => field.isSearchable),
    );
    const supportsCustomAttributes = entities.some((name) =>
      (STORY_SCHEMA_ENTITY_TYPES as readonly string[]).includes(name),
    );
    return hasNativeSearchableFields || supportsCustomAttributes;
  }, [advancedSearchScopes, entityName]);
  const canFilterByField = !!(storyId && entityName && onAdvancedSearch && hasAdvancedSearchFields);

  // Controlled from the parent, mirrored locally for the pill controls: when the parent's
  // props change (a filter cleared elsewhere, a deep link), the render-time comparisons
  // below resync the local selections instead of leaving the pills showing stale state.
  const [prevSelectedFilterValues, setPrevSelectedFilterValues] = useState(selectedFilterValues);
  if (selectedFilterValues !== prevSelectedFilterValues) {
    setPrevSelectedFilterValues(selectedFilterValues);
    setSelectedFilter(selectedFilterValues || []);
  }

  const [prevFavoriteFilterState, setPrevFavoriteFilterState] = useState(
    currentFavoriteFilterState,
  );
  if (currentFavoriteFilterState !== prevFavoriteFilterState) {
    setPrevFavoriteFilterState(currentFavoriteFilterState);
    setInternalFavoriteFilterState(currentFavoriteFilterState || 'all');
  }

  const [prevCurrentSortValue, setPrevCurrentSortValue] = useState(currentSortValue);
  if (currentSortValue !== prevCurrentSortValue) {
    setPrevCurrentSortValue(currentSortValue);
    setSelectedSort(currentSortValue || null);
  }

  /**
   * The search input still updates on every keystroke (kept live via `onSearch`), but the
   * committed search that drives the fetch is debounced upstream so a paused fetch doesn't
   * fire on every character. Enter/the mobile return key skips that wait and blurs, rather
   * than leaving the keyboard open until the debounce catches up.
   */
  const handleSearchSubmitEditing = useCallback(() => {
    Keyboard.dismiss();
    onSearchSubmit?.();
  }, [onSearchSubmit]);

  const handleSearchClear = useCallback(() => {
    onSearch('');
    onSearchSubmit?.('');
  }, [onSearch, onSearchSubmit]);

  const handleFilterSelection = (values: string | string[] | null) => {
    const newValues = Array.isArray(values) ? values : values ? [values] : [];
    setSelectedFilter(newValues);
    onFilterChange(newValues);
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    onSortDirectionChange(newDirection);
  };

  const handleFavoriteFilterChange = useCallback(
    (state: FavoriteFilterState) => {
      setInternalFavoriteFilterState(state);
      onFavoriteFilterChange?.(state);
    },
    [onFavoriteFilterChange],
  );

  const handleFavoriteFilterToggle = () => {
    if (disableFavoriteFilter) return;
    handleFavoriteFilterChange(
      internalFavoriteFilterState === 'all'
        ? 'favorite'
        : internalFavoriteFilterState === 'favorite'
          ? 'not-favorite'
          : 'all',
    );
  };

  const handleOpenAdvancedSearchModal = useCallback(() => {
    if (canFilterByField) setIsAdvancedSearchModalVisible(true);
  }, [canFilterByField]);
  const handleCloseAdvancedSearchModal = useCallback(
    () => setIsAdvancedSearchModalVisible(false),
    [],
  );
  const handleAdvancedSearchSubmit = useCallback(
    (criteria: AdvancedSearchCriteria) => {
      onAdvancedSearch && onAdvancedSearch(criteria);
      setIsAdvancedSearchModalVisible(false);
    },
    [onAdvancedSearch],
  );

  const activeCriteriaCount = countActiveCriteria(currentAdvancedSearchCriteria);
  const hasActiveFilters =
    !!currentSearchTerm?.trim() ||
    selectedFilter.length > 0 ||
    internalFavoriteFilterState !== 'all' ||
    activeCriteriaCount > 0;

  const handleRemoveCriterion = useCallback(
    (key: string) => onAdvancedSearch?.(withoutCriterion(currentAdvancedSearchCriteria, key)),
    [currentAdvancedSearchCriteria, onAdvancedSearch],
  );

  /** Search words, tags, favorites and field filters - everything that narrows the list. */
  const handleClearAll = useCallback(() => {
    onSearch('');
    onSearchSubmit?.('');
    if (selectedFilter.length > 0) {
      setSelectedFilter([]);
      onFilterChange([]);
    }
    if (internalFavoriteFilterState !== 'all') handleFavoriteFilterChange('all');
    if (activeCriteriaCount > 0) onAdvancedSearch?.({});
  }, [
    activeCriteriaCount,
    handleFavoriteFilterChange,
    internalFavoriteFilterState,
    onAdvancedSearch,
    onFilterChange,
    onSearch,
    onSearchSubmit,
    selectedFilter.length,
  ]);

  // The search and the filter and sort controls are tour targets, named by the kind of list.

  const styles = useMemo(() => createStyles(colors), [colors]);

  const usesColoredFilterOptions = !!filterOptions?.some((option) => !!option.color);
  // A story without tags has nothing to filter by; the pill would only open an empty list.
  const showTagFilter =
    !disableTagFilter && ((filterOptions?.length ?? 0) > 0 || selectedFilter.length > 0);
  const showFavoriteFilter = !disableFavoriteFilter;
  // With a tag pill the star sits beside it; without one it joins the sort row.
  const favoriteInTagRow = showTagFilter && showFavoriteFilter;

  const tagFilter = usesColoredFilterOptions ? (
    <MultiSelectPill
      options={(filterOptions || []).map((option) => ({
        ...option,
        color: option.color || undefined,
      }))}
      selectedValues={selectedFilter}
      onSelectionChange={handleFilterSelection}
      placeholder={filterPlaceholder ?? t('filter_by_tags')}
      style={{ marginBottom: 0 }}
      triggerStyle={{
        borderColor: colors.primary,
        borderRadius: 5,
        height: 50,
        minHeight: 50,
        paddingVertical: 6,
        flexWrap: 'nowrap',
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    />
  ) : (
    <MultiSelectPill
      options={(filterOptions || []).map((option) => ({
        ...option,
        color: option.color ?? undefined,
      }))}
      selectedValues={selectedFilter}
      onSelectionChange={handleFilterSelection}
      placeholder={filterPlaceholder ?? t('filter_by_tags')}
      disabled={disableTagFilter}
      style={styles.compactSelect}
    />
  );

  const sortPicker = (
    <SingleSelectPill
      options={sortOptions || []}
      value={selectedSort}
      onValueChange={onSortChange}
      placeholder={t('sort_by')}
      style={styles.compactSelect}
    />
  );

  const favoriteButton = (
    <FavoriteFilterButton
      state={internalFavoriteFilterState}
      onPress={handleFavoriteFilterToggle}
    />
  );
  const directionButton = (
    <SortDirectionButton direction={sortDirection} onPress={handleSortDirectionToggle} />
  );
  const filtersButton = canFilterByField ? (
    <FiltersButton count={activeCriteriaCount} onPress={handleOpenAdvancedSearchModal} />
  ) : null;

  const searchField = (
    <ListSearchField
      value={currentSearchTerm || ''}
      placeholder={searchPlaceholder || t('search')}
      onChangeText={onSearch}
      onSubmitEditing={handleSearchSubmitEditing}
      onClear={handleSearchClear}
    />
  );

  const handleToolbarLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width !== toolbarWidth) setToolbarWidth(width);
  };

  return (
    <View style={styles.container} onLayout={handleToolbarLayout}>
      {isWide ? (
        <View style={styles.row}>
          <GuideAnchor screen={entityName ?? 'List'} part="search" style={styles.grow3}>
            {searchField}
          </GuideAnchor>
          <GuideAnchor
            screen={entityName ?? 'List'}
            part="controls"
            style={[styles.row, styles.grow4]}
          >
            {showTagFilter ? <View style={styles.grow}>{tagFilter}</View> : null}
            <View style={styles.grow}>{sortPicker}</View>
            {showFavoriteFilter ? favoriteButton : null}
            {directionButton}
          </GuideAnchor>
          {filtersButton}
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <GuideAnchor screen={entityName ?? 'List'} part="search" style={styles.grow}>
              {searchField}
            </GuideAnchor>
            {filtersButton}
          </View>
          <GuideAnchor screen={entityName ?? 'List'} part="controls" style={styles.controls}>
            {showTagFilter ? (
              <View style={styles.row}>
                <View style={styles.grow}>{tagFilter}</View>
                {favoriteInTagRow ? favoriteButton : null}
              </View>
            ) : null}
            <View style={styles.row}>
              <View style={styles.grow}>{sortPicker}</View>
              {showFavoriteFilter && !favoriteInTagRow ? favoriteButton : null}
              {directionButton}
            </View>
          </GuideAnchor>
        </>
      )}

      {filterComponent}

      <ActiveFilterChips
        storyId={storyId}
        entityName={entityName}
        scopes={advancedSearchScopes}
        criteria={currentAdvancedSearchCriteria}
        favoriteState={internalFavoriteFilterState}
        onClearFavorite={() => handleFavoriteFilterChange('all')}
        onRemoveCriterion={handleRemoveCriterion}
        onClearAll={handleClearAll}
      />

      <View style={styles.resultsRow}>
        {isLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.resultsLoading} />
        )}
        <Text style={styles.resultsCountText}>
          {t('total_results_found', { count: data.length })}
          {resultsMeta ? ` (${resultsMeta})` : ''}
        </Text>
      </View>
      {resultsNotice}
      <SearchHighlightContext.Provider value={currentSearchTerm ?? ''}>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={
            onContentWidthChange ? (width) => onContentWidthChange(width) : undefined
          }
          ListEmptyComponent={
            emptyListComponent ||
            (hasActiveFilters ? (
              <NoResultsState onClear={handleClearAll} />
            ) : (
              <GuidedEmptyState
                title={emptyStateTitle}
                message={emptyStateMessage}
                actions={emptyStateActions}
                entityName={entityName}
                fallbackText={t('no_items_found')}
              />
            ))
          }
          style={styles.list}
        />
      </SearchHighlightContext.Provider>
      {canFilterByField && storyId && entityName && (
        <AdvancedSearchModal
          entityName={entityName}
          storyId={storyId}
          isVisible={isAdvancedSearchModalVisible}
          onClose={handleCloseAdvancedSearchModal}
          onSearch={handleAdvancedSearchSubmit}
          initialCriteria={currentAdvancedSearchCriteria}
          scopes={advancedSearchScopes}
          previewCount={onPreviewCount}
          // The star button already filters favorites (per person when favorites are individual);
          // the field would read the story-wide column instead.
          excludeFields={showFavoriteFilter ? ['isFavorite'] : []}
        />
      )}
    </View>
  );
};

const createStyles = (colors: { background: string; textSecondary: string }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 10,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    grow: {
      flex: 1,
    },
    grow3: {
      flex: 3,
    },
    grow4: {
      flex: 4,
      marginBottom: 0,
    },
    controls: {
      flexDirection: 'column',
      zIndex: 1, // Add zIndex to create a stacking context
    },
    // A regular field keeps space below itself for a following form control. In this toolbar that
    // margin becomes part of the row's height and shifts the icon buttons down from their select.
    compactSelect: {
      marginBottom: 0,
    },
    list: {
      flex: 1,
    },
    resultsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingLeft: 10,
    },
    resultsLoading: {
      marginRight: 8,
    },
    resultsCountText: {
      color: colors.textSecondary,
      textAlign: 'left',
      fontSize: 16,
    },
  });

export default GenericFilterSortList;
