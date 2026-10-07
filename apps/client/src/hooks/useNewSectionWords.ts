import { type SectionWords, sectionWordsFor } from '@keres/shared';
import { useStoryStore } from '../state/storyStore';

/**
 * The words that name a section the writer adds ("Verse", "Verso"): those of the language of the
 * story, not of the app. A song belongs to its story, and its labels are written out in its text, so
 * switching the app to another language never renames a part of a song.
 */
export function useNewSectionWords(): SectionWords {
  const language = useStoryStore((state) => state.selectedStory?.language);
  return sectionWordsFor(language);
}
