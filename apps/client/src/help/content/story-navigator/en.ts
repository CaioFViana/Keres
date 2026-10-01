import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-navigator',
  title: 'Story Navigator',
  summary:
    'Walk a branching story one scene at a time, exactly as a reader would, to test choices, conditions and effects.',
  keywords: [
    'navigator',
    'simulate',
    'simulation',
    'test',
    'play',
    'branching',
    'choice',
    'trigger',
    'item',
    'route',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The Story Navigator is a simulation of reading your branching story. It shows one scene, the state the reader carries - items and triggers - and the choices available from that scene. Choose one and you land in the next scene, with that choice’s effects and the next scene’s own effects applied, just as they would be for a real reader.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'It only exists in branching stories. In a linear story there is nothing to choose, so the screen says it is unavailable.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You suspect the “Open the vault” choice can never be taken, because the key is granted by a scene the reader might skip. Start at the first scene, walk the path you worry about, and see the choice stay dimmed, with the reason written under it.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Plots', 'Story navigator'] },
    {
      type: 'steps',
      items: [
        'Open Plots and tap Story navigator (the play icon) in the header. It starts at the scene marked as the start, or at the first scene when none is marked.',
        'Use Start scene to begin somewhere else. Picking a scene restarts the simulation from it.',
        'Read the scene card: its name, its summary, and below it what the reader holds and which triggers are active.',
        'Tap a choice to follow it. A choice that the current state does not allow is dimmed and says why - for example that it requires a trigger, or is blocked by one that is active.',
        'Keep choosing until you reach a scene that says This path ends here.',
        'Tap the scene’s name to open it and edit it; going back returns you to the Navigator.',
        'Restart simulation begins again from the start scene, with nothing carried over.',
      ],
    },
    { type: 'heading', level: 2, text: 'Reading the card' },
    {
      type: 'table',
      headers: ['What you see', 'What it means'],
      rows: [
        [
          'Visited, Items, Triggers',
          'How many scenes the walk went through, how many items it holds, and how many triggers are active.',
        ],
        ['Items now / Active triggers', 'The names of those items and triggers.'],
        [
          'The lines with a bullet',
          'What just happened: the choice taken, the scene entered, and every item or trigger granted, removed, activated or deactivated on the way.',
        ],
        [
          'A dimmed choice',
          'A choice whose conditions fail right now, with the trigger or condition that stops it.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Turning a walk into a Route' },
    {
      type: 'paragraph',
      text: 'The simulation is temporary; leaving the screen forgets it. When a walk is worth keeping, Save as route creates a Route from the scenes you went through, with a suggested name you can change. Replace route writes the walk over the steps of a Route that already exists - after asking you to confirm, because the old steps are lost. Replace needs a Route to exist already.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Replace route overwrites every step of the Route you pick. Use Save as route when in doubt.',
    },
    { type: 'heading', level: 2, text: 'Where else it shows up' },
    {
      type: 'paragraph',
      text: 'The Manuscript of a branching story has an Explore scenes view that is the same walk, showing each scene’s prose instead of its summary. There, comments can be read and added while you explore.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The Navigator changes nothing in the story: no scene, choice, item or trigger is edited by walking it, and the walk is not synced or recorded in the activity log. Only Save as route and Replace route write anything, and only to Routes. What it shows depends on what you authored in Choices, Choice conditions and Effects, so an unexpected result usually points at one of those.',
    },
    {
      type: 'seeAlso',
      pages: ['routes', 'choices', 'choice-conditions', 'effects', 'story-state', 'manuscript'],
    },
  ],
};
export default page;
