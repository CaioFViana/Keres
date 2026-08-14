import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-dashboard',
  title: 'The story dashboard',
  summary: 'See a picture of the open story and shortcuts for reviewing your plan.',
  keywords: ['dashboard', 'summary', 'counts', 'shortcuts'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The dashboard is the home page of an open story. It summarizes how many elements you added and shows recent activity.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'When you see many scenes but no locations, you notice that you may still need to record where those events take place.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open a story from the list.',
        'Use the story name at the top to confirm which story is open.',
        'Read summary cards for counts of characters, locations, chapters, scenes, and other elements.',
        'Tap the analysis shortcut when you want to review warnings.',
        'Use the menu to open the list of an element you want to complete.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The dashboard only shows recorded information; it does not create or change elements. Counts change when you add, edit, or delete content.',
    },
    { type: 'seeAlso', pages: ['story-analysis', 'characters', 'scenes'] },
  ],
};
export default page;
