import { headerAnchorId, screenAnchorId } from './anchorRegistry';
import type { Guide } from './types';

/**
 * The tours of the places where writing happens: the form every entity shares, the scene's prose
 * editor, the scene's page and the scene's music. The form tour belongs to the form container, so it
 * plays once, on the first entity form opened, whichever entity that is.
 */
export const writingGuides: Record<string, Guide> = {
  EntityForm: {
    id: 'EntityForm',
    drawerId: 'main-system',
    helpPageId: 'first-story',
    steps: [
      {
        id: 'fields',
        anchors: [screenAnchorId('EntityForm', 'fields')],
        titleKey: 'tour_entityform_fields_title',
        bodyKey: 'tour_entityform_fields_body',
      },
      {
        id: 'reset',
        anchors: [headerAnchorId('arrow-undo-outline')],
        titleKey: 'tour_entityform_reset_title',
        bodyKey: 'tour_entityform_reset_body',
      },
      {
        id: 'actions',
        anchors: [screenAnchorId('EntityForm', 'actions')],
        titleKey: 'tour_entityform_actions_title',
        bodyKey: 'tour_entityform_actions_body',
      },
    ],
  },
  SceneEditor: {
    id: 'SceneEditor',
    drawerId: 'main-system',
    helpPageId: 'manuscript',
    steps: [
      {
        id: 'modes',
        // The icon of a mode is filled while it is the one on, so both are named.
        anchors: [
          'pencil',
          'pencil-outline',
          'book',
          'book-outline',
          'chatbubbles',
          'chatbubbles-outline',
          'arrow-undo-outline',
        ].map(headerAnchorId),
        titleKey: 'tour_sceneeditor_modes_title',
        bodyKey: 'tour_sceneeditor_modes_body',
      },
      {
        id: 'toolbar',
        anchors: [screenAnchorId('SceneEditor', 'toolbar')],
        titleKey: 'tour_sceneeditor_toolbar_title',
        bodyKey: 'tour_sceneeditor_toolbar_body',
      },
      {
        id: 'footer',
        anchors: [screenAnchorId('SceneEditor', 'footer')],
        titleKey: 'tour_sceneeditor_footer_title',
        bodyKey: 'tour_sceneeditor_footer_body',
      },
    ],
  },
  SceneDetail: {
    id: 'SceneDetail',
    drawerId: 'main-system',
    helpPageId: 'manuscript',
    steps: [
      {
        id: 'actions',
        anchors: [headerAnchorId('pencil-outline'), headerAnchorId('document-text-outline')],
        titleKey: 'tour_scenedetail_actions_title',
        bodyKey: 'tour_scenedetail_actions_body',
      },
      {
        id: 'pages',
        anchors: [screenAnchorId('SceneDetail', 'pages')],
        titleKey: 'tour_scenedetail_pages_title',
        bodyKey: 'tour_scenedetail_pages_body',
      },
      {
        id: 'music',
        anchors: [screenAnchorId('SceneDetail', 'music')],
        titleKey: 'tour_scenedetail_music_title',
        bodyKey: 'tour_scenedetail_music_body',
      },
    ],
  },
  SceneMusic: {
    id: 'SceneMusic',
    drawerId: 'main-system',
    helpPageId: 'scene-music',
    steps: [
      {
        id: 'notice',
        anchors: [screenAnchorId('SceneMusic', 'notice')],
        titleKey: 'tour_scenemusic_notice_title',
        bodyKey: 'tour_scenemusic_notice_body',
      },
      {
        id: 'cards',
        anchors: [screenAnchorId('SceneMusic', 'cards')],
        titleKey: 'tour_scenemusic_cards_title',
        bodyKey: 'tour_scenemusic_cards_body',
      },
      {
        id: 'add',
        anchors: [headerAnchorId('add')],
        titleKey: 'tour_scenemusic_add_title',
        bodyKey: 'tour_scenemusic_add_body',
      },
    ],
  },
};
