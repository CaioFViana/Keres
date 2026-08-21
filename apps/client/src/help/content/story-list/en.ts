import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-list',
  title: 'The story list',
  summary: 'Open, organize, and identify stories that exist on this device.',
  keywords: ['stories', 'favorite', 'server', 'delete'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The story list is the first screen after initial setup. Each card represents a story that you can open, edit, favorite, or delete.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You keep “Current Novel” as a favorite and leave “Experiments” unmarked. When you return to the app, you recognize the first card and open it to continue planning.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Tap a card to open its story.',
        'Tap the star to mark or unmark Favorite.',
        'Tap the pencil to edit story details.',
        'Use the + button to create a new story.',
        'Open Menu › Import and export to bring in an exported copy or save a backup.',
        'When editing a story, use Delete only when you are sure; export first if you want to keep a copy.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A card shows its title, genre, description, and, when present, the server linked to the story. Opening a story changes the menu to its tools; favoriting changes the card’s mark.',
    },
    { type: 'seeAlso', pages: ['create-story', 'favorites', 'import-export', 'what-is-a-server'] },
  ],
};
export default page;
