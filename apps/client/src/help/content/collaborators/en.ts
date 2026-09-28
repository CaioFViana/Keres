import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'collaborators',
  title: 'Writing together',
  summary: 'Invite friends to read or edit a synchronized story.',
  keywords: ['collaborator', 'owner', 'writer', 'reader'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Collaborators are friends who accepted an invitation to a story sent to a server. The owner controls access; writers edit; readers view. Nothing reaches the friend’s devices until they accept.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You remain the owner, invite Joana as a writer to fill scenes, and Leo as a reader to follow the review.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Send the story to a server and become friends with the person on that same server.',
        'Open Story menu › Story settings.',
        'In the collaborators area, choose a friend and the wanted role, then tap Invite.',
        'The friend accepts or declines in Friends; until then the invitation shows as pending, where you can change the offered role or withdraw it.',
        'For readers, turn on Allow reader comments if you want them to comment on fields.',
        'Change the role or remove the collaborator at any time.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Writers can change content according to story access; readers cannot edit. Comments, public favorites, and synchronization show collaborator data when their corresponding features are active.',
    },
    { type: 'seeAlso', pages: ['friends', 'comments', 'sync-basics', 'story-settings'] },
  ],
};
export default page;
