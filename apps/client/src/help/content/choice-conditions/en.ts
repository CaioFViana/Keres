import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'choice-conditions',
  title: 'Conditions for a choice',
  summary: 'Define when a choice is blocked or enabled for a reader.',
  keywords: ['condition', 'block', 'enable', 'item', 'marker', 'visit'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Conditions define when a choice is blocked or enabled. They can check how often a scene was visited, whether the reader has an item, and whether a marker is set or unset.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The choice “Open the safe” should only be available after the reader found the key. Create an inventory condition for the key and set it to Enable. Without the key, the choice is not enabled.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Choices and create or edit a choice in a branching story.',
        'Save the choice first. The Conditions section appears once it exists.',
        'Tap Add condition group. Within a group, choose All (AND) to require every condition or Any (OR) to accept one of them.',
        'Tap Add condition and choose its Type: Scene visits, Inventory, or Marker. Fill in the scene and visit count, the item and whether it must be present or absent, or the marker name and state.',
        'Choose Block to prevent the choice when the condition is met, or Enable to make it available when the condition is met.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Conditions appear in choice details and are considered by path analysis. The items and markers they use come from the reader state, which is changed by scene and choice effects.',
    },
    { type: 'seeAlso', pages: ['choices', 'effects', 'story-state', 'story-analysis'] },
  ],
};

export default page;
