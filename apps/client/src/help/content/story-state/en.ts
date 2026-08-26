import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-state',
  title: 'Inventory and markers',
  summary: 'Understand what the reader carries and which events the story records.',
  keywords: ['inventory', 'marker', 'reader state', 'item', 'condition', 'effect'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The reader state is the set of items they carry and markers the story records, such as “spoke to Mara” or “alarm off”. It is used to plan the paths of a branching story.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The library scene gives the reader the Observatory key. Later, the “Open the observatory” choice checks whether that key is in the inventory. Speaking with Mara can set a marker that unlocks another question.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'First create the Items that can be given or taken during the story.',
        'Open a saved scene or choice and, in the Effects section, add Give item, Take item, Set marker, or Unset marker.',
        'For a marker, always use the same name when you mean the same event, such as “met_mara”.',
        'Open the choice that depends on that state and add an Inventory or Marker condition.',
        'Check its details and Story analysis to make sure paths have the intended effects and conditions.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'You do not fill in a reader inventory in a separate list. It is described by the effects you place on scenes and choices.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Choice conditions read inventory and markers to block or enable options. Later effects can change that state again, so consistent marker names make analysis and revision clearer.',
    },
    { type: 'seeAlso', pages: ['items', 'effects', 'choice-conditions', 'choices'] },
  ],
};

export default page;
