import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-settings',
  title: 'Story settings',
  summary: 'Adjust decisions that apply to the whole story.',
  keywords: ['collaborators', 'server', 'comments', 'timing', 'favorites'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Story settings gathers options that do not belong to a single character, scene, or chapter.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'When review begins, you can add an editor as a reader and allow their comments without giving permission to edit scenes.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Story settings'] },
    {
      type: 'steps',
      items: [
        'Open the section you want to change.',
        'Use Story type to convert between Linear and Branching.',
        'Use Collaborators to invite, remove, or adjust access.',
        'Use Send to server to link a local story to a server.',
        'Enable reader comments when you want observations from readers.',
        'Use the reading-preferences card to choose favorite behavior, link mentions automatically, and normalize scene timing while it is displayed.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'These choices can make Choices available, control what collaborators see or change, define where the story synchronizes, change how favorites appear to the team, turn recognized names in text into links, and change how scene durations are displayed.',
    },
    {
      type: 'seeAlso',
      pages: ['story-type', 'collaborators', 'sync-basics', 'favorites', 'appearance'],
    },
  ],
};
export default page;
