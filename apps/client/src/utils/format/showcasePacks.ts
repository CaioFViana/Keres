import type { PackContentSummary } from '@keres/shared';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * What a pack brings, as short phrases for chips, in the words the app's own pack list uses: only what is there
 * (a pack that brings nothing is the caller's to describe).
 */
export function packSummaryChips(summary: PackContentSummary, t: Translate): string[] {
  const counted: [number, string][] = [
    [summary.fieldCount, 'packs_chip_attributes'],
    [summary.suggestionCount, 'packs_chip_suggestions'],
    [summary.tagCount, 'packs_chip_tags'],
    [summary.statCount, 'packs_chip_stats'],
    [summary.chapterCount, 'packs_chip_chapters'],
    [summary.sceneCount, 'packs_chip_scenes'],
    [summary.characterCount, 'packs_chip_characters'],
    [summary.locationCount, 'packs_chip_locations'],
    [summary.worldRuleCount, 'packs_chip_worldrules'],
    [summary.noteCount, 'packs_chip_notes'],
    [summary.boardCount, 'packs_chip_boards'],
    [summary.locationMapCount, 'packs_chip_maps'],
  ];
  const chips = counted.filter(([count]) => count > 0).map(([count, key]) => t(key, { count }));
  if (summary.hasVocabulary) chips.push(t('packs_chip_vocabulary'));
  return chips;
}

/** Whether a pack matches what was typed in the search: its name, description or author, ignoring case. */
export function packMatches(
  pack: { name: string; description: string | null; authorName: string | null },
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [pack.name, pack.description, pack.authorName].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}
