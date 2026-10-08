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
        'The screen is a list of sections. Open the one you want to change; each section saves only its own fields, so leaving one without saving never touches the others.',
        'General holds the title, type, description and Adults-only (+18). Use Story type to convert between Linear and Branching, and the reading choices to set the behavior of favorites, link mentions automatically and normalize scene timing while it is displayed.',
        'Appearance holds the cover and the story’s theme - see Appearance.',
        'Vocabulary, Custom Attributes and Standard Suggestions open the screens that rename the story’s terms, add fields to its elements and choose the suggestions it offers.',
        'Server and collaborators links a local story to a server (Send to Server), invites, removes or adjusts people’s access, and lets readers comment. On a story someone else owns, this section offers Leave this story instead - see Writing together. A build with no server does not have it.',
        'Delete story is at the end of the list and is offered only to the story’s owner.',
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
