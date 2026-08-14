import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'your-profile',
  title: 'Your profile',
  summary: 'Choose how other people see you on a server.',
  keywords: ['your profile', 'help'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Your profile gathers display name, @tag, avatar, and bio. Friends use the @tag to find you.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Consult your profile when this part of your work needs a decision or review.',
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
