import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kick-the-dog',
  title: 'Kick the dog',
  summary: 'A gratuitous cruelty that settles who the antagonist is.',
  keywords: ['kick the dog', 'chutar o cao', 'villain', 'cruelty', 'antagonist', 'establishing'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An act of cruelty with no strategic benefit, staged so the audience stops giving the character the benefit of the doubt. Because it costs the antagonist nothing to avoid, it reads as character rather than as necessity.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'An antagonist has been abstract and needs to become personal.',
        'You need the audience to accept a harsh response from the protagonist later.',
        'A system, not a person, is the villain, and you need one human face for it.',
        'A likeable character must be revealed as dangerous.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The landlord has already won the case. On the way out, he tells the tenant her father would have been ashamed of her. Nothing is gained by it.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Using it so early that the antagonist can never be more than a monster.',
        'Escalating cruelty in place of escalating threat.',
        'Cruelty aimed at a character the story never invested in, which lands on nobody.',
      ],
    },
    { type: 'seeAlso', pages: ['pet-the-dog', 'save-the-cat', 'the-foil', 'role-reversal'] },
  ],
};
export default page;
