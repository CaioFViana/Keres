import type { ShowcaseFacets } from '@keres/shared';
import { SHOWCASE_SORTS } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ListSearchField from '@/src/components/common/lists/GenericFilterSortList/ListSearchField';
import { FiltersButton } from '@/src/components/common/lists/GenericFilterSortList/ListToolbarButtons';
import type { ShowcaseFilters } from '@/src/utils/format/showcaseFilters';
import ShowcaseFiltersModal from './ShowcaseFiltersModal';

interface ShowcaseSearchBarProps {
  /** Only the stories have filters and an order; the authors and the packs are only searched. */
  withFilters: boolean;
  placeholder: string;
  filters: ShowcaseFilters;
  onChange: (filters: ShowcaseFilters) => void;
  /** What the server can filter by, with counts; `null` while unread or when it could not say. */
  facets: ShowcaseFacets | null;
}

/** How many of the story filters narrow the list now (the order does not narrow it, and the search has its own box). */
const activeFilterCount = (filters: ShowcaseFilters) =>
  [filters.genre, filters.language, filters.type, filters.medium].filter(Boolean).length;

/**
 * The search of the showcase, laid out the way the app's lists are: the search box with a "Filters" button
 * beside it (the filters themselves open in a dialog, with a count of how many are on), and the order below.
 */
const ShowcaseSearchBar: React.FC<ShowcaseSearchBarProps> = ({
  withFilters,
  placeholder,
  filters,
  onChange,
  facets,
}) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <ListSearchField
            value={filters.q}
            placeholder={placeholder}
            onChangeText={(q) => onChange({ ...filters, q })}
            onSubmitEditing={() => undefined}
            onClear={() => onChange({ ...filters, q: '' })}
            accessibilityLabel={t('showcase_search')}
            autoCapitalize="none"
            testID="showcase-search"
          />
        </View>
        {withFilters ? (
          <FiltersButton count={activeFilterCount(filters)} onPress={() => setFiltersOpen(true)} />
        ) : null}
      </View>
      {withFilters ? (
        <>
          <SingleSelectPill
            style={styles.sort}
            value={filters.sort}
            onValueChange={(sort) =>
              onChange({ ...filters, sort: (sort as ShowcaseFilters['sort']) ?? 'recent' })
            }
            options={SHOWCASE_SORTS.map((sort) => ({
              label: t(`showcase_sort_${sort}`),
              value: sort,
            }))}
            placeholder={t('showcase_filter_sort')}
          />
          <ShowcaseFiltersModal
            visible={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            filters={filters}
            onChange={onChange}
            facets={facets}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  sort: { marginBottom: 0 },
});

export default ShowcaseSearchBar;
