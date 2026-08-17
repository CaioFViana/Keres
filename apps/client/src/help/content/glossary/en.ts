import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'glossary',
  title: 'Glossary',
  summary: 'Look up the meaning of terms that appear in the interface.',
  keywords: ['glossary', 'scene', 'chapter', 'marker', 'tag'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'This glossary summarizes interface terms; each linked page explains the feature in more detail.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'When you read “Marker” in a condition, use this summary and open Inventory and markers to configure the feature.',
    },
    { type: 'heading', level: 3, text: 'Main terms' },
    {
      type: 'table',
      headers: ['Term', 'Meaning'],
      rows: [
        ['Scene', 'A story moment, linked to a location and optionally a chapter.'],
        ['Choice', 'A decision leading from one scene to another in a branching story.'],
        ['Marker', 'A name recording that something happened in reader state.'],
        ['Tag', 'A short word that groups elements.'],
        ['Collaborator', 'A person with owner, writer, or reader access to a synchronized story.'],
        [
          'Recovery code',
          'A one-time code shown when you create an account on a server, used to set a new password if you forget it.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Search for the term in Help.',
        'Open the page listed in See also to learn how to use the feature.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The glossary does not change your story; it only helps interpret names used on screens.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'tags', 'collaborators', 'story-state'] },
  ],
};
export default page;
