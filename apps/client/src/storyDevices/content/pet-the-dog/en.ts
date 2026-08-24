import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'pet-the-dog',
  title: 'Pet the dog',
  summary: 'A moment of real humanity in the villain or the anti-hero.',
  keywords: ['pet the dog', 'acariciar o cao', 'villain', 'humanity', 'antihero', 'complexity'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A brief, unforced tenderness from a character the audience has been taught to condemn. It does not excuse anything; it makes the condemnation more expensive, because the audience must hold both facts at once.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'An antagonist is efficient but flat.',
        'You want the audience uncomfortable at the ending rather than satisfied.',
        'The theme argues that harm comes from ordinary people.',
        'An anti-hero protagonist needs a floor beneath the cruelty.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The enforcer waits, without complaint, while an old woman finds her keys. Then he goes into the building and does what he came to do.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Placing it so it functions as an apology for the character.',
        'One tender moment used to justify an unearned redemption later.',
        'Making it charming rather than human, which is flattery, not complexity.',
      ],
    },
    { type: 'seeAlso', pages: ['kick-the-dog', 'save-the-cat', 'the-foil', 'mary-sue'] },
  ],
};
export default page;
