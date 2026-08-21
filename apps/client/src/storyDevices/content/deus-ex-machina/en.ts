import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'deus-ex-machina',
  title: 'Deus ex machina',
  summary: 'An unprepared external rescue. Usually a defect, occasionally a statement.',
  keywords: ['deus ex machina', 'contrivance', 'rescue', 'ending', 'coincidence', 'unearned'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A problem declared unsolvable is solved by a force the work never established: an unknown ally, an unmentioned rule, a sudden accident of luck. It is listed here mainly so you can recognise it in your own drafts, where it usually appears as relief.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Deliberately, when the theme is that the world is indifferent or absurd.',
        'As a diagnostic: if your ending needs one, the middle is missing a setup.',
        'In comedy, where the mechanical rescue can be the joke and is acknowledged as such.',
        'As an opening rather than an ending, where unearned luck starts a problem instead of ending one.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The siege breaks because a storm arrives. That is a rescue. It becomes something else if, forty pages earlier, someone dismissed the seasonal storms as a superstition.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Confusing preparation with prediction; a setup can be quiet and still be fair.',
        'Solving with a character who has no stake in the outcome.',
        'Using it and then having characters remark on the coincidence, which names the flaw without fixing it.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['chekhovs-gun', 'setup-and-payoff', 'lampshading', 'impossible-choice'],
    },
  ],
};
export default page;
