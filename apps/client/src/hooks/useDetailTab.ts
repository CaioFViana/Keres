import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import type { OccurrenceTarget } from '../utils/occurrenceTarget';
import { detailTabForField, type DetailTabKey } from '../utils/detailTabs';

/**
 * The tab on show in a detail screen. It starts on the details, or on the tab that holds the field
 * a search result or a backlink is landing on, and follows a new landing target.
 */
export function useDetailTab(occurrence?: OccurrenceTarget | null) {
  const landingTab: DetailTabKey = occurrence ? detailTabForField(occurrence.field) : 'details';
  const [tab, setTab] = useState<DetailTabKey>(landingTab);
  const [landedOn, setLandedOn] = useState(occurrence);
  if (occurrence !== landedOn) {
    setLandedOn(occurrence);
    if (occurrence) setTab(landingTab);
  }
  return [tab, setTab] as const;
}

export function useDetailTabItems(t: TFunction) {
  return useMemo(
    () => [
      { key: 'details' as const, label: t('detail_tab_details') },
      { key: 'relations' as const, label: t('detail_tab_relations') },
      { key: 'other' as const, label: t('detail_tab_other') },
    ],
    [t],
  );
}
