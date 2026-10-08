import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-dashboard',
  title: 'The story dashboard',
  summary: 'See a picture of the open story and shortcuts for reviewing your plan.',
  keywords: ['dashboard', 'summary', 'counts', 'shortcuts', 'continue writing', 'resume', 'arcs'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The dashboard is the home page of an open story. It has a Write block to pick up where you left off, summarizes how many elements you added, shows recent activity, and surfaces a banner when sync conflicts need your review.',
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
        'Under Write, Continue writing reopens the scene you edited last, with its chapter and how long ago; New scene, New character and New note open the blank forms. A reader sees Open instead and no new-item shortcuts.',
        'The Manuscript card counts scenes and chapters and has Read and Export; Publish is there too for the story’s owner, where there is a server.',
        'Under the universe’s arcs, Manage opens the arcs, tapping an arc edits it, and Add Arc creates one.',
        'Read summary cards for counts of characters, locations, chapters, scenes, and other elements.',
        'Tap the analysis shortcut when you want to review warnings.',
        'If a red conflict banner appears, tap it to review pending sync conflicts for this story.',
        'Use the menu to open the list of an element you want to complete.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The dashboard only shows recorded information; it does not create or change elements, and its shortcuts only open screens that already exist - nothing is created until you save there. Each shortcut’s arrow takes you back to the dashboard. Counts change when you add, edit, or delete content. The conflict banner only appears while unreviewed sync conflicts exist for the open story.',
    },
    { type: 'seeAlso', pages: ['story-analysis', 'sync-conflicts', 'characters', 'scenes'] },
  ],
};
export default page;
