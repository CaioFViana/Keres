import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'lists-and-search',
  title: 'Lists, search, and filters',
  summary: 'Find story elements without opening every screen by hand.',
  keywords: ['search', 'filter', 'tags', 'favorites', 'advanced search'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Lists show elements of one type, such as Characters or Scenes. They offer search, sorting, Tag filters, and a favorites view; Advanced Search combines fields, while Global Search looks through the open story.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Before reviewing the second act, search for “Lia”, filter by the “review” tag, and show favorites to reach priority scenes and characters quickly.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the element list from the menu.',
        'Type a word in the search field to reduce the list.',
        'Use filtering and sorting controls when you need to narrow or reorganize results.',
        'Mark items as favorites so you can find them again with the favorites filter.',
        'In Advanced Search, choose the fields and values that must be combined.',
        'In Global Search, opened within a story, search across several element types at once.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Searching, filtering, and sorting do not change the story. Favoriting only changes an item’s mark; how that mark is shared depends on the story’s favorite settings.',
    },
    { type: 'seeAlso', pages: ['tags', 'favorites', 'custom-attributes'] },
  ],
};
export default page;
