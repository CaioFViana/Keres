import type { ShowcaseFacet, ShowcaseFacets } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import {
  hasActiveShowcaseFilters,
  NO_SHOWCASE_FILTERS,
  type ShowcaseFilters,
} from '@/src/utils/format/showcaseFilters';

interface ShowcaseFiltersModalProps {
  visible: boolean;
  onClose: () => void;
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

/**
 * The story filters - genre, language, structure, form of the work - kept out of the way of the list behind
 * the "Filters" button, as the app's lists keep their field filters. Each choice narrows the list at once;
 * the button below only closes the dialog on the result.
 */
const ShowcaseFiltersModal: React.FC<ShowcaseFiltersModalProps> = ({
  visible,
  onClose,
  filters,
  onChange,
  facets,
}) => {
  const { t } = useTranslation();
  const set = (patch: Partial<ShowcaseFilters>) => onChange({ ...filters, ...patch });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      tone="raised"
      inset="roomy"
      maxHeight="86%"
    >
      <ModalHeader title={t('list_filters_button')} onClose={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" testID="showcase-filters">
        <SingleSelectPill
          value={filters.genre}
          onValueChange={(genre) => set({ genre })}
          options={optionsOf(facets?.genres, filters.genre)}
          placeholder={t('showcase_filter_genre')}
          allowDeselect
        />
        <SingleSelectPill
          value={filters.language}
          onValueChange={(language) => set({ language })}
          options={optionsOf(facets?.languages, filters.language)}
          placeholder={t('showcase_filter_language')}
          allowDeselect
        />
        <SingleSelectPill
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
          value={filters.medium}
          onValueChange={(medium) => set({ medium: (medium as ShowcaseFilters['medium']) ?? null })}
          options={optionsOf(facets?.mediums, filters.medium, (value) => t(`arc_medium_${value}`))}
          placeholder={t('showcase_filter_medium')}
          allowDeselect
        />
      </ScrollView>
      <View style={styles.footer}>
        {hasActiveShowcaseFilters(filters) ? (
          <View style={styles.button}>
            <Button
              variant="secondary"
              icon="close-circle-outline"
              onPress={() => onChange({ ...NO_SHOWCASE_FILTERS, sort: filters.sort })}
              testID="showcase-filters-clear"
            >
              {t('showcase_filters_clear')}
            </Button>
          </View>
        ) : null}
        <View style={styles.button}>
          <Button onPress={onClose} testID="showcase-filters-done">
            {t('advanced_search_apply')}
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1 },
});

export default ShowcaseFiltersModal;
