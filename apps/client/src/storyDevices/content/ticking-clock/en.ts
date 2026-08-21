import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'ticking-clock',
  title: 'Ticking clock',
  summary: 'A hard deadline that turns hesitation into cost.',
  keywords: ['ticking clock', 'deadline', 'relogio', 'urgency', 'time limit', 'pressure'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An externally imposed limit — a departure, a trial date, a rising tide, an oxygen gauge — that makes every delay expensive. It converts vague urgency into arithmetic the audience can track, and it forces characters to act on incomplete information.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The middle of the work drifts because nothing punishes waiting.',
        'You want a character to make a bad decision plausibly.',
        'A scene needs pressure without adding a new antagonist.',
        'You need the audience to feel structure without being told the structure.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The hearing is Thursday. Every chapter header is a day of the week, and by Wednesday the protagonist is choosing between evidence and sleep.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'A clock the story keeps forgetting, so the audience stops believing it.',
        'Extending the deadline to solve a problem, which teaches that the clock is decorative.',
        'Using a countdown so tight that no scene can breathe or reflect.',
      ],
    },
    { type: 'seeAlso', pages: ['pacing', 'impossible-choice', 'macguffin', 'cliffhanger'] },
  ],
};
export default page;
