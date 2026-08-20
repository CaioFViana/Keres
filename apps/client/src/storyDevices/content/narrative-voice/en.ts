import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'narrative-voice',
  title: 'Narrative voice and psychic distance',
  summary: 'How close the narration sits to a character mind, and how that distance moves.',
  keywords: [
    'narrative voice',
    'psychic distance',
    'voz narrativa',
    'distancia psiquica',
    'free indirect',
    'diction',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Even within one point of view, the narration can stand far away — naming a city and a year — or press so close that its vocabulary becomes the character vocabulary. Free indirect style lives at the near end, where thought and narration merge without quotation.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A scene needs to open wide and then close in on one person.',
        'You want interiority without italicised thoughts or first person.',
        'The character diction is more interesting than neutral prose.',
        'A traumatic or overwhelming moment needs sudden distance, or sudden closeness.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'It was March in a town of four thousand. The clinic opened at eight. She hated the clinic. God, the smell of it, the pink chairs, eight in the morning and already someone crying.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Shifting distance at random, which reads as an unsteady hand.',
        'Staying at maximum closeness so long that no scene can be framed.',
        'Letting narration use words the character would never have.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['point-of-view', 'unreliable-narrator', 'show-dont-tell', 'pacing'],
    },
  ],
};
export default page;
