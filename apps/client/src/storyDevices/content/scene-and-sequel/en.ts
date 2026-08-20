import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'scene-and-sequel',
  title: 'Scene and sequel',
  summary:
    'Action units alternate with reaction units: goal, conflict, disaster, then emotion, dilemma, decision.',
  keywords: [
    'scene and sequel',
    'cena e sequencia',
    'reaction',
    'goal conflict disaster',
    'rhythm',
    'structure',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A rhythm for prose: a scene is a character pursuing a goal, meeting conflict, and ending worse off; a sequel is the shorter unit where they feel it, weigh bad options, and choose the next goal. The sequel is what converts events into a character who is deciding rather than being pushed.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The work is eventful but the protagonist feels passive.',
        'Readers say it is exciting but they do not care.',
        'You need interiority without stopping the story.',
        'A long action sequence needs somewhere for consequence to land.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Scene: she tries to get the records and is thrown out. Sequel: half a page of fury, two bad options, and the decision to call the person she swore never to call.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Skipping every sequel, which produces a chase with no one inside it.',
        'Writing sequels as long as scenes, which stalls the work.',
        'Ending a sequel without a decision, so the next scene has no goal.',
      ],
    },
    { type: 'seeAlso', pages: ['in-late-out-early', 'story-circle', 'pacing', 'want-vs-need'] },
  ],
};
export default page;
