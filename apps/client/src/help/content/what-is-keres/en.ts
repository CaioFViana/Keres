import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'what-is-keres',
  title: 'What is Keres?',
  summary: 'A place to organize your story world, even without an internet connection.',
  keywords: ['start', 'planning', 'offline', 'organize story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Keres is a story-planning app. It brings together characters, locations, chapters, scenes, items, rules, and notes for you to consult while writing.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You write a chapter in your preferred editor. In Keres, you record that Lia found a key at the station, who was with her, and which scene it happened in. Later, you can find that detail without rereading the whole manuscript.',
    },
    {
      type: 'paragraph',
      text: 'Keres organizes the narrative world; it is not a manuscript editor. You can write your text wherever you prefer.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'On your first visit, choose your local name and language.',
        'From the main menu, create a story.',
        'Open it and begin with the element you already know: a character, location, chapter, or scene.',
        'Return to the lists whenever you want to complete or revise information.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Everything you record is available in lists, searches, details, and relationships within that story. The app works offline; a server is only needed if you want to synchronize devices or collaborate.',
    },
    { type: 'seeAlso', pages: ['first-story', 'how-keres-organizes', 'what-is-a-server'] },
  ],
};
export default page;
