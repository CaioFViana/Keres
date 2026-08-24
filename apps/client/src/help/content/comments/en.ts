import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'comments',
  title: 'Comments',
  summary: 'Discuss a specific field on a profile while reviewing a story.',
  keywords: ['comment', 'review', 'critique', 'excerpt', 'team'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Comments are conversations attached to a visible field on a profile, such as a character Biography or a choice Text. They keep the message, quoted excerpt, and a criticality level.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'In Mara’s Biography, your collaborator quotes “she left the fleet” and writes that it contradicts a scene. The comment remains attached to Biography, so revision reaches the right place.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open an element’s details and tap the speech bubble next to a field that accepts comments.',
        'Write the comment. If useful, enter the excerpt it refers to and choose the criticality level shown by the icons.',
        'Post it to add the message to that field’s conversation.',
        'Open Story menu › Comments to see comments from the whole story. Tapping one opens the commented element’s details.',
        'The comment author and story owner can manage it according to the available permissions.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Notes keep story material. Comments are for discussing a profile or excerpt during review.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The bubble counter shows how many comments a field has, and the Comments list gathers every conversation in the story. In shared stories, the ability to comment depends on permissions and the setting that allows reader comments.',
    },
    { type: 'seeAlso', pages: ['notes', 'collaborators', 'story-settings', 'activity-log'] },
  ],
};

export default page;
