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
        'The friend accepts or declines in Manage Friendships; until then the invitation shows as pending, where you can change the offered role or withdraw it.',
        'For readers, turn on Allow reader comments if you want them to comment on fields.',
        'Change the role or remove the collaborator at any time. Removing takes the access away: the collaborator is told, and the copy of the story on their devices is removed - at once if they are connected, otherwise the next time they sync.',
        'A collaborator can leave on their own: in Story settings of a story someone else owns, tap Leave this story. They lose access, the copy on this device is removed, and the owner can invite them again.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Writers can change content according to story access; readers cannot edit. Comments, public favorites, and synchronization show collaborator data when their corresponding features are active.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'A writer who is removed, or who leaves, loses the copy on their devices together with any edit that had not reached the server yet. Ending a friendship does the same to every story the two of you shared.',
    },
    {
      type: 'paragraph',
      text: 'You do not need to refresh anything: on all your devices the collaborators list updates by itself when someone accepts, leaves, is removed, or has their role changed.',
    },
    { type: 'seeAlso', pages: ['friends', 'comments', 'sync-basics', 'story-settings'] },
  ],
};
export default page;
