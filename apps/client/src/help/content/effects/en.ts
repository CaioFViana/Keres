import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'effects',
  title: 'Scene or choice effects',
  summary: 'Record changes to items and markers caused by a scene or decision.',
  keywords: ['effect', 'give item', 'take item', 'marker', 'inventory'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Effects record a change caused by a scene or choice: give the reader an item, take an item, set a marker, or unset one. They form the state that conditions can consult later.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'When the reader chooses “Take the key,” you add a Give item effect and select the key. The choice “Open the safe” can then be enabled by the inventory condition that looks for that item.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open a scene or choice in a branching story and save it if it is new.',
        'In the Effects section, tap Add effect.',
        'Choose Give item or Take item and select the matching Item; or choose Set marker or Unset marker and enter the marker name.',
        'Save the scene or choice. You can review its effects in its details.',
        'Use Story analysis to check paths that depend on those effects.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Effects feed the reader’s inventory and markers. Choice conditions read that information to block or enable paths, and the scene or choice details list the configured effects.',
    },
    { type: 'seeAlso', pages: ['choices', 'scenes', 'choice-conditions', 'story-state'] },
  ],
};

export default page;
