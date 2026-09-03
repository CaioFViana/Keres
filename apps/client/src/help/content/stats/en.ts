import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'stats',
  title: 'Stats',
  summary: 'Measure characters on axes you define and compare them on a radar chart.',
  keywords: ['stat', 'status', 'radar', 'tier', 'ranking', 'comparison', 'strength'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An optional system, turned on per story, for measuring characters on axes you create — Strength, Cunning, Reputation. Each axis has a ladder of tiers, and every character can hold a value on it, per mode.',
    },
    {
      type: 'paragraph',
      text: 'Primary stats become the axes of the radar chart. Secondary stats are only listed as text, and there is no limit to them. The chart needs at least three primary stats and accepts at most twelve.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'With the ladder F starting at 0, C at 50 and A at 400, a character with 100 in Strength sits inside C, one third of the way to A. Someone above the last tier is drawn in the dashed band outside the chart.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Customization', 'Stats'] },
    {
      type: 'steps',
      items: [
        'Open Stats in Customization, turn on the stat system, and choose the notation: letters or numbers.',
        'Create the axes. Mark as primary the ones you want on the chart.',
        'Edit the story default ladder, and give a stat its own ladder only when it needs a different scale.',
        'Open a character, choose Edit, and fill in the values. A mode without its own value inherits the normal mode.',
        'While typing, the ruler under the field shows where each tier starts and where the value falls.',
        'Use Compare to overlay up to four characters or modes, and Ranking to list everyone by one stat.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'What this axis measures. Fill it in to save.',
          note: 'Appears on the chart, in the list and in the ranking.',
        },
        {
          key: 'isPrimary',
          label: 'Primary',
          whatToWrite: 'Turn it on for the stat to be an axis of the radar chart.',
          note: 'At most twelve primary stats; secondary ones are unlimited.',
        },
        {
          key: 'label',
          label: 'Tier label',
          whatToWrite: 'How the tier is shown, such as F, C or SS.',
          note: 'Only used in letter notation; numbers show the value itself.',
        },
        {
          key: 'minValue',
          label: 'Tier floor',
          whatToWrite: 'The lowest value that already belongs to this tier.',
          note: 'Never negative and never repeated inside the same ladder.',
        },
        {
          key: 'value',
          label: 'Value',
          whatToWrite: 'How much this character has of this stat.',
          note: 'A value above the last tier is drawn outside the chart.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Turning the system off hides the character panel and statistic tools; nothing is deleted, and turning it back on restores everything. Deleting a stat removes the values recorded for it in every character.',
    },
    { type: 'seeAlso', pages: ['characters', 'character-modes', 'custom-attributes'] },
  ],
};
export default page;
