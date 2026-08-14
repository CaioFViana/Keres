import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-conflicts',
  title: 'When a conflict appears',
  summary: 'Choose which version to keep when two changes compete.',
  keywords: ['when a conflict appears', 'help'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A conflict asks for a field-by-field decision: keep yours, keep the server version, accept a deletion, or postpone.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Consult when a conflict appears when this part of your work needs a decision or review.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the matching screen from the menu.',
        'Read the information or choose the needed action.',
        'Confirm the change when the screen asks.',
        'Return to the story or list to check the result.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The result can appear in collaboration, synchronization, lists, or related details according to the action taken.',
    },
    { type: 'seeAlso', pages: ['using-this-help', 'sync-basics', 'data-and-backup'] },
  ],
};
export default page;
