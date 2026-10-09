import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'lists-and-search',
  title: 'Lists, search, and filters',
  summary: 'Find story elements without opening every screen by hand.',
  keywords: ['search', 'filter', 'filters', 'tags', 'favorites', 'sort', 'advanced search'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Lists show elements of one type, such as Characters or Scenes. They offer search, sorting, a Tag filter, a favorites view and Filters, which narrow the list by any field; Global Search looks through the open story.',
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
        'Type a word in the search field to reduce the list; the part that matched is highlighted, and the x empties the field.',
        'Use the tag filter and the sorting controls when you need to narrow or reorganize results.',
        'Mark items as favorites so you can find them again with the star, which cycles all, favorites and not favorites.',
        'Tap Filters, then Add filter, to choose the fields and values that must be combined. The name starts open; press Enter or Show results to apply.',
        'What narrows the list - favorites and each field filter - shows as a chip under the search, with an x to remove it and Clear filters to remove them all. The number on Filters counts the field filters.',
        'When nothing matches, the list says so and offers Clear filters.',
        'In Global Search, opened within a story, search across several element types at once.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Searching, filtering, and sorting do not change the story. Some lists remember their filters for the next visit; the chips show them. Favoriting only changes an item’s mark; how that mark is shared depends on the story’s favorite settings.',
    },
    { type: 'seeAlso', pages: ['tags', 'favorites', 'custom-attributes'] },
  ],
};
export default page;
