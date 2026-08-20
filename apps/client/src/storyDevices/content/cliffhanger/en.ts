import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'cliffhanger',
  title: 'Cliffhanger',
  summary: 'Cut at the peak of tension so the audience cannot stop.',
  keywords: ['cliffhanger', 'gancho', 'chapter end', 'suspense', 'serial', 'unresolved'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Ending a chapter, episode, or scene at an unresolved moment: a question asked, a door opening, a decision suspended. It works on the gap between promise and answer, and it costs nothing at the time — the bill arrives when the next unit must justify the wait.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Serialised release, where the audience must choose to come back.',
        'Cutting between parallel storylines, so the interruption itself does work.',
        'A chapter has run its course but the tension has not.',
        'You want to end on a question rather than on a summary.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The chapter ends as she recognises the handwriting. The next chapter opens somewhere else entirely, and the recognition sits there, waiting.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Resolving the cliff cheaply at the start of the next unit, which trains distrust.',
        'Using one at every chapter end until they read as a tic, not an event.',
        'Manufacturing suspense by withholding what a viewpoint character already knows.',
      ],
    },
    { type: 'seeAlso', pages: ['chapter-hook', 'in-late-out-early', 'ticking-clock', 'pacing'] },
  ],
};
export default page;
