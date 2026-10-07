import { screenAnchorId } from './anchorRegistry';
import type { Guide } from './types';

/** The tours of the song screens: the list, the editor, and the Tune tab on its first opening. */
export const songGuides: Record<string, Guide> = {
  SongStack: {
    id: 'SongStack',
    drawerId: 'main-system',
    helpPageId: 'songs',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Songs', 'list')],
        titleKey: 'tour_songs_start_title',
        bodyKey: 'tour_songs_start_body',
      },
    ],
  },
  SongEditor: {
    id: 'SongEditor',
    drawerId: 'main-system',
    helpPageId: 'songs',
    steps: [
      {
        id: 'tabs',
        anchors: [screenAnchorId('SongEditor', 'tabs')],
        titleKey: 'tour_songeditor_tabs_title',
        bodyKey: 'tour_songeditor_tabs_body',
      },
      {
        id: 'words',
        anchors: [screenAnchorId('SongEditor', 'words')],
        titleKey: 'tour_songeditor_words_title',
        bodyKey: 'tour_songeditor_words_body',
      },
    ],
  },
  // Opens the first time the Tune tab does, not with the screen: the tab is where the sound is.
  SongTune: {
    id: 'SongTune',
    drawerId: 'main-system',
    helpPageId: 'songs',
    steps: [
      {
        id: 'player',
        anchors: [screenAnchorId('SongTune', 'player')],
        titleKey: 'tour_songtune_player_title',
        bodyKey: 'tour_songtune_player_body',
      },
      {
        id: 'parts',
        anchors: [screenAnchorId('SongTune', 'parts')],
        titleKey: 'tour_songtune_parts_title',
        bodyKey: 'tour_songtune_parts_body',
      },
    ],
  },
};
