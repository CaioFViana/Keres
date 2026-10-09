import type { ReactNode } from 'react';

/**
 * A stand-in for `DetailTabs` in a detail screen's own test: every panel is shown at once, so the test
 * can look at the whole screen. How the tabs open, hide and keep their content is covered by
 * `DetailTabs.test.tsx`, and where each section sits by `detailTabsPlacement.test.ts`.
 */
export const DetailTabs = () => null;

export const DetailTabPanels = ({ panels }: { panels: Record<string, ReactNode> }) => (
  <>
    {panels.details}
    {panels.relations}
    {panels.other}
  </>
);
