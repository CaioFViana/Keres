import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'how-keres-organizes',
  title: 'How Keres organizes a story',
  summary: 'Understand how narrative elements connect within a story.',
  keywords: ['chapters', 'scenes', 'characters', 'organization'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A story is the container for your project. Inside it, chapters group scenes; characters, locations, items, and world rules can be linked to several events.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'In the chapter “The Journey”, the scene “Leaving the station” takes place at Central Station, brings together Lia and Omar, and uses the key as an important item. You can open and revise each piece of information without duplicating its description.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Chapters or Scenes'] },
    {
      type: 'steps',
      items: [
        'Create chapters to organize reading order.',
        'Create scenes and choose a chapter and location for each one.',
        'Add characters, locations, items, and rules when you need them.',
        'In edit screens, use Tags, Notes, Comments, and See also to add context and links.',
        'Use lists and Global Search to find information in the open story.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Relationships appear in details, searches, and maps. In branching stories, scenes and choices also form the story map and can be checked by analysis.',
    },
    { type: 'seeAlso', pages: ['chapters', 'scenes', 'lists-and-search', 'see-also'] },
  ],
};
export default page;
