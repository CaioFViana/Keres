import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'in-media-res',
  title: 'In medias res',
  summary: 'Open in the middle of the action and fill in the context later.',
  keywords: ['in medias res', 'opening', 'cold open', 'meio da acao', 'hook', 'start late'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The work begins at a moment of pressure already underway, and whatever the audience needs to understand it arrives afterwards, distributed through the scenes that follow. It buys attention with a question the audience wants answered.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The natural chronological beginning is necessary but not interesting.',
        'You need a first page or first minute that earns the second.',
        'The premise is easy to grasp without preamble.',
        'You want the exposition to be read as an answer rather than a lecture.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Rather than opening with the interview, open with her already in the elevator with the file she was not supposed to take, hands shaking, forty floors to decide.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Opening on chaos the audience cannot parse, so there is no question, only noise.',
        'Following the hook with a long flashback that undoes the momentum you just bought.',
        'Using it reflexively, until every chapter starts mid-sprint and nothing lands.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['in-late-out-early', 'fichtean-curve', 'chapter-hook', 'frame-story'],
    },
  ],
};
export default page;
