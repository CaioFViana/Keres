import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';

/** A song of the story: its lyrics with chords, its notes, its melody. */
export const songEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Song,
  exportCollection: 'songs',
  conflictLabelKey: 'song',
  displayField: 'title',
  previewDetailsFields: ['notes'],
  help: {
    source: 'songs',
    fields: ['title', 'notes', 'lyrics', 'lyricsTranslation', 'melody', 'key', 'tempo', 'meter'],
  },
  advancedSearch: [
    searchField('title', 'field_title'),
    searchField('notes', 'field_notes'),
    searchField('lyrics', 'field_lyrics'),
    searchField('lyricsTranslation', 'field_lyrics_translation'),
  ],
});
