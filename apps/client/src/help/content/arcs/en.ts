import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'arcs',
  title: 'Arcs, volumes and phases',
  summary:
    'Organize one story into books, phases or other large sections without splitting its world.',
  keywords: ['arc', 'arcs', 'volume', 'volumes', 'phase', 'chapters', 'events', 'theme'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An arc is a large section inside one story: a book in a series, a phase of a campaign, or a distinct movement in a long narrative. The story still has one shared cast, world, calendar and set of notes.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Every story begins with one default arc. It gives every chapter and event somewhere to belong, so you never need to set one up before you can write.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'Use arcs when the same world needs clearer editorial boundaries. They let you focus lists and views on one book or phase while characters, places and other shared material remain available throughout the story.',
    },
    {
      type: 'example',
      title: 'A trilogy in one story',
      text: 'Create an arc for each book of a trilogy. Assign each chapter to its book. A character introduced in the first book remains the same character in the second, while the chapter lists and narrative views can stay focused on the book you are revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Customization', 'Arcs'] },
    {
      type: 'steps',
      items: [
        'Open Customization from the story menu and choose Arcs.',
        'Choose Add to create another arc, then give it a clear name.',
        'Optionally add a description and choose a theme for that arc.',
        'Open a chapter or event and choose the arc it belongs to.',
        'Use the arc selector in the story header when you want to focus on one arc.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Name',
          whatToWrite: 'A name for the book, phase or other section.',
          note: 'Use a name that remains clear when selecting the arc from a chapter or event.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'A short note about the purpose, period or focus of this arc.',
          note: 'Optional; it can help distinguish similar sections while planning.',
        },
        {
          key: 'themeOverride',
          label: 'Theme',
          whatToWrite: 'Choose a theme for this arc, or leave it using the story theme.',
          note: 'The theme changes the appearance while this arc is selected; it does not change the story theme.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Chapters and events belong to one arc. Scenes, characters, places and items remain shared through the story, and are shown in an arc when they appear through those chapters or events. Removing an extra arc moves its chapters to the default arc instead.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'The default arc cannot be removed. It is the safe destination for chapters when another arc is removed.',
    },
    { type: 'seeAlso', pages: ['chapters', 'appearance', 'story-settings'] },
  ],
};

export default page;
