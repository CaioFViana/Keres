import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'save-the-cat',
  title: 'Save the cat',
  summary: 'An early act of decency that buys the audience sympathy.',
  keywords: [
    'save the cat',
    'salve o gato',
    'likeability',
    'sympathy',
    'introduction',
    'first impression',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A small, costly kindness performed early, usually when nobody is watching. It is not about making the character nice: it gives the audience a reason to stay with someone whose later behaviour will be difficult.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The protagonist is abrasive, criminal, or cold and must still be followed.',
        'The first impression is doing double duty as characterisation and invitation.',
        'You need to establish the value the character will later betray.',
        'An ensemble needs each member distinguished quickly.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Before we learn what he does for a living, he pays for a stranger short at the till and does not wait to be thanked.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'A kindness that costs nothing, which reads as decoration.',
        'Performing it for an audience inside the story, which turns it into strategy.',
        'Using it as a substitute for making the character interesting.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['pet-the-dog', 'kick-the-dog', 'character-arc', 'save-the-cat-beat-sheet'],
    },
  ],
};
export default page;
