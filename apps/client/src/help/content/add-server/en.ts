import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'add-server',
  title: 'Adding a server',
  summary: 'Connect an existing account or create an account on a Keres server.',
  keywords: ['server', 'address', 'sign in', 'create account', 'forgot password', 'recovery code'],
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
        'Enter the server Address, without paths such as /api, /admin or /swagger, your username, and password.',
        'When creating an account, confirm the password and, if you want, give the server a Name to recognize it in the list.',
        'Confirm. When creating a new account, the screen then shows a list of recovery codes.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Save these recovery codes somewhere safe before leaving the screen. They are shown this one time only, and each one lets you get back into your account if you ever forget your password.',
    },
    { type: 'heading', level: 3, text: 'Forgot your password?' },
    {
      type: 'paragraph',
      text: 'If you already have an account but do not remember its password, you do not need the old one to get back in.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'This is for signing in to a server for the first time on this device. If the server is already in your list, use Changing your password instead - no need to remove and add it again.',
    },
    {
      type: 'steps',
      items: [
        'On the sign-in screen, tap Forgot your password?.',
        'Enter your username, one of the recovery codes you saved, and the new password you want to use.',
        'Confirm. You are signed in right away with the new password.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Each recovery code works only once. If you run out, ask whoever manages the server to give you new ones.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The server appears in the list with connection state, your @tag, and the last synchronization date. You can then send stories to it, edit your profile, change the password, and recover access later with a saved recovery code if needed.',
    },
    {
      type: 'seeAlso',
      pages: ['what-is-a-server', 'your-profile', 'change-password', 'sync-basics'],
    },
  ],
};
export default page;
