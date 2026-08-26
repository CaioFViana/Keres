import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'using-this-help',
  title: 'Using this help',
  summary: 'Search for a question or browse by subject without leaving the app.',
  keywords: ['help', 'search', 'see also', 'not found'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Help is an in-app catalog. It explains tasks and fields using the same language as the screens instead of showing technical details.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'If you want to understand why a choice does not appear, search for “condition”. If you are still learning the app, open “Start here” and follow the pages in order.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Help from the last item in the main or story menu.',
        'Use the fixed bar at the top to search by title, keyword, field, or explanation text.',
        'Search ignores accents; for example, “historia” also finds “história”.',
        'Clear search with the × button to return to sections in the state they were in.',
        'Open a result to read the full page.',
        'Use See also at the bottom of a page to continue with a related subject.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Help search does not change the story, does not enter Global Search, and does not save history. Internal links let you move through pages and return one page at a time.',
    },
    { type: 'seeAlso', pages: ['lists-and-search', 'faq', 'troubleshooting'] },
  ],
};
export default page;
