import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'point-of-view',
  title: 'Point of view',
  summary: 'Who perceives the scene, and what that choice makes impossible.',
  keywords: [
    'point of view',
    'ponto de vista',
    'first person',
    'third limited',
    'omniscient',
    'pov',
    'focalisation',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The position from which the work perceives: first person, third limited, third omniscient, second person, or a rotating cast. Each choice grants access to one interior and denies access to others, and that denial is usually the most useful part.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Deciding early, since changing it later rewrites everything.',
        'A mystery depends on someone not knowing something.',
        'You need intimacy with one character or ironic distance from all of them.',
        'An ensemble needs its viewpoints assigned by what only that character can witness.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The same funeral told by the widow, by the accountant, and by an omniscient narrator is three different works with the same events.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Slipping into another head mid-scene without intending to.',
        'Choosing omniscience to avoid choosing, then never using its advantages.',
        'Rotating viewpoints so often that no interior gets established.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['narrative-voice', 'unreliable-narrator', 'dramatic-irony', 'frame-story'],
    },
  ],
};
export default page;
