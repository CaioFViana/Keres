import type { ShowcaseFacet, ShowcaseFacets } from '@keres/shared';
import { SHOWCASE_SORTS } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  hasActiveShowcaseFilters,
  NO_SHOWCASE_FILTERS,
  type ShowcaseFilters,
} from '@/src/utils/format/showcaseFilters';

interface ShowcaseFiltersBarProps {
  filters: ShowcaseFilters;
  onChange: (filters: ShowcaseFilters) => void;
  /** What the server can filter by, with counts; `null` while unread or when it could not say. */
  facets: ShowcaseFacets | null;
}

/** A facet's values as options, with how many stories carry each; the chosen one stays even if no story does. */
function optionsOf(
  facets: ShowcaseFacet[] | undefined,
  chosen: string | null,
  labelOf: (value: string) => string = (value) => value,
) {
  const options = (facets ?? []).map((facet) => ({
    label: `${labelOf(facet.value)} (${facet.count})`,
    value: facet.value,
  }));
  if (chosen && !options.some((option) => option.value === chosen)) {
    options.unshift({ label: labelOf(chosen), value: chosen });
  }
  return options;
}

/** The filters of the story list: genre, language, structure, form of the work and order. */
const ShowcaseFiltersBar: React.FC<ShowcaseFiltersBarProps> = ({ filters, onChange, facets }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<ShowcaseFilters>) => onChange({ ...filters, ...patch });

  return (
    <View style={styles.bar} testID="showcase-filters">
      <SingleSelectPill
        style={styles.pill}
        value={filters.genre}
        onValueChange={(genre) => set({ genre })}
        options={optionsOf(facets?.genres, filters.genre)}
        placeholder={t('showcase_filter_genre')}
        allowDeselect
      />
      <SingleSelectPill
        style={styles.pill}
        value={filters.language}
        onValueChange={(language) => set({ language })}
        options={optionsOf(facets?.languages, filters.language)}
        placeholder={t('showcase_filter_language')}
        allowDeselect
      />
      <SingleSelectPill
        style={styles.pill}
        value={filters.type}
        onValueChange={(type) => set({ type: (type as ShowcaseFilters['type']) ?? null })}
        options={[
          { label: t('showcase_type_linear'), value: 'linear' },
          { label: t('showcase_type_branching'), value: 'branching' },
        ]}
        placeholder={t('showcase_filter_type')}
        allowDeselect
      />
      <SingleSelectPill
        style={styles.pill}
        value={filters.medium}
        onValueChange={(medium) => set({ medium: (medium as ShowcaseFilters['medium']) ?? null })}
        options={optionsOf(facets?.mediums, filters.medium, (value) => t(`arc_medium_${value}`))}
        placeholder={t('showcase_filter_medium')}
        allowDeselect
      />
      <SingleSelectPill
        style={styles.pill}
        value={filters.sort}
        onValueChange={(sort) => set({ sort: (sort as ShowcaseFilters['sort']) ?? 'recent' })}
        options={SHOWCASE_SORTS.map((sort) => ({
          label: t(`showcase_sort_${sort}`),
          value: sort,
        }))}
        placeholder={t('showcase_filter_sort')}
      />
      {hasActiveShowcaseFilters(filters) ? (
        <Button
          variant="secondary"
          icon="close-circle-outline"
          onPress={() => onChange(NO_SHOWCASE_FILTERS)}
          testID="showcase-filters-clear"
        >
          {t('showcase_filters_clear')}
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { minWidth: 140, flexGrow: 1, flexBasis: 140 },
});

export default ShowcaseFiltersBar;
