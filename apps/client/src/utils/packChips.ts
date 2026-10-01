import type { PackContentCounts } from '../services/storymanagement/PackService';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One chip per skeleton collection the pack carries, nonzero only.
 *
 * The local list and the shipped packs screens share this: both read the same counts, and a chip
 * the two disagree on would be a lie in one of them. Remote browse rows have no chips at all -
 * the list endpoint never opens a payload, so there are no counts to show until download.
 */
export function packExtrasChips(counts: PackContentCounts, t: Translate): string[] {
  const extras = counts.extras;
  return [
    extras.chapters > 0 && t('packs_chip_chapters', { count: extras.chapters }),
    extras.scenes > 0 && t('packs_chip_scenes', { count: extras.scenes }),
    extras.characters > 0 && t('packs_chip_characters', { count: extras.characters }),
    extras.locations > 0 && t('packs_chip_locations', { count: extras.locations }),
    extras.worldRules > 0 && t('packs_chip_worldrules', { count: extras.worldRules }),
    extras.notes > 0 && t('packs_chip_notes', { count: extras.notes }),
    extras.storyBoards > 0 && t('packs_chip_boards', { count: extras.storyBoards }),
    extras.storyLocationMaps > 0 && t('packs_chip_maps', { count: extras.storyLocationMaps }),
  ].filter((chip): chip is string => Boolean(chip));
}
