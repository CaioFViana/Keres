import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'friends',
  title: 'Friends',
  summary: 'Send and respond to friendship requests on the same server.',
  keywords: ['friend', 'tag', 'request', 'accept'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Friendship links two accounts on the same server. It is needed before adding someone as a story collaborator.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You look up Joana’s @tag, send a request, and after she accepts, invite her to write on your story.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Friends from the main menu and tap add.',
        'Choose the server, enter the person’s @tag, and tap check.',
        'Confirm the request once the found account is correct.',
        'In the list, open a received request to accept, decline, or undo a friendship.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Friendship only applies to the selected server. Once accepted, the person can be selected as a collaborator; undoing it does not delete stories but can prevent future invitations.',
    },
    { type: 'seeAlso', pages: ['your-profile', 'collaborators', 'what-is-a-server'] },
  ],
};
export default page;
