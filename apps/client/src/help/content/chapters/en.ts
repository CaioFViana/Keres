import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'chapters',
  title: 'Chapters',
  summary: 'Group scenes by the order in which readers encounter them or in chronological order.',
  keywords: ['chapter', 'order', 'summary', 'scenes'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Chapters organize scenes in the story’s reading order or chronological. You are free to decide how to organize it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A prologue can be the first chapter read or only for the author’s own organization, even when it shows an event from twenty years earlier. Order records reading or world chronology.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Narrative Elements', '+'] },
    {
      type: 'steps',
      items: [
        'Create a chapter and enter Name.',
        'Use Summary to record its role in the narrative.',
        'Save it, open the chapter in the list, and create or associate scenes inside it.',
        'Use chapter reordering when you want to change reading order.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'A title by which you recognize the chapter. Fill it in to save.',
          note: 'Appears in lists and when choosing a scene chapter.',
        },
        {
          key: 'summary',
          label: 'Summary',
          whatToWrite: 'What happens or what this chapter does.',
          note: 'Helps review the overall rhythm.',
        },
        {
          key: 'arcId',
          label: 'Arc',
          whatToWrite: 'Choose the arc, volume or phase this chapter belongs to.',
          note: 'Scenes in the chapter inherit that arc.',
        },
        {
          key: 'order',
          label: 'Order',
          whatToWrite: 'The intended reading position.',
          note: 'It does not have to represent world chronology.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight the chapter.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Reminders that do not fit in the summary.',
          note: 'They remain in chapter details.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Scenes use their chapter to appear grouped and ordered. Deleting a chapter requires reviewing scenes that depend on it.',
    },
    { type: 'seeAlso', pages: ['scenes', 'story-dashboard', 'lists-and-search'] },
  ],
};
export default page;
