import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'add-server',
  title: 'Adding a server',
  summary: 'Connect an existing account or create an account on a Keres server.',
  keywords: ['server', 'address', 'sign in', 'create account'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    { type: 'paragraph', text: 'This form adds the account you use on a Keres server to the app.' },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You receive the address https://keres.example.com. With it and your account, you can synchronize the same story between devices.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'From the main menu, open Servers and tap add.',
        'Choose Sign in for an existing account or Create account for a new one.',
        'Enter the server Address, without paths such as /admin or /swagger, your username, and password.',
        'When creating an account, confirm the password. Give the server a Name if you want to recognize it in the list and confirm.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The server appears in the list with connection state, your @tag, and the last synchronization date. You can then send stories to it, edit your profile, and change the password.',
    },
    { type: 'seeAlso', pages: ['what-is-a-server', 'your-profile', 'sync-basics'] },
  ],
};
export default page;
