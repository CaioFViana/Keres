import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'branching-basics',
  title: 'How branching stories work',
  summary: 'Connect scenes through choices to plan alternative narrative paths.',
  keywords: ['branching', 'path', 'choice', 'map', 'reader', 'ending'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A branching story organizes scenes as paths that split and can meet again later. Each choice starts at one scene, shows text to the reader, and leads to another scene.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'After “The station door opens,” the reader can follow Mara to the train or investigate the corridor. You create two choices in that scene, each leading to a different scene. Later, both paths can meet again at the same revelation.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'When creating the story, choose the Branching type. For an existing story, open Story menu › Story settings and change the type when conversion is allowed.',
        'Create the scenes that represent moments in the narrative. Mark a Start scene to show where a path begins.',
        'In the Story menu, open Choices and create a choice: select the Source scene, write the text shown to the reader, and select the Destination scene.',
        'Open Story map to check the paths. Use Story analysis to find scenes with no links or paths that cannot be reached.',
        'When a path depends on what happened earlier, add conditions and effects to the choice or scene.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Converting a branching story to linear can require adjustments. Before confirming, read the list of incompatible chapters shown by the app.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The Branching type makes the Choices menu and Story map available. Choices change the paths shown on the map and the warnings in Story analysis. Conditions and effects use the reader state to decide which paths are available.',
    },
    {
      type: 'seeAlso',
      pages: ['story-type', 'choices', 'story-map', 'choice-conditions', 'effects', 'story-state'],
    },
  ],
};
export default page;
