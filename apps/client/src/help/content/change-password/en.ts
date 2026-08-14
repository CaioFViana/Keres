import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'change-password',
  title: 'Changing your password',
  summary: 'Change the password for your account on an added server.',
  keywords: ['password', 'account', 'server'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'This screen changes the account password on the selected server; it does not change the app’s local name.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You want to replace an old password before using the account on another device.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Servers from the main menu.',
        'On the wanted server, tap the key icon.',
        'Enter Current password, New password, and Confirm new password.',
        'Save. The new password must meet the minimum length shown by the screen.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The change applies to the account on that server. Other devices may need to sign in again with the new password; it does not alter stories or profiles.',
    },
    { type: 'seeAlso', pages: ['add-server', 'your-profile', 'troubleshooting'] },
  ],
};
export default page;
