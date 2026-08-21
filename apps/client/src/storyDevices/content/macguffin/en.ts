import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'macguffin',
  title: 'MacGuffin',
  summary: 'The thing everyone chases, whose nature barely matters.',
  keywords: ['macguffin', 'objective', 'objeto de desejo', 'chase', 'briefcase', 'plot motor'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An object, person, or goal that drives the plot by being wanted. Its function is to put characters in motion and in conflict; what it actually is can remain vague, because the meaning of the work lives in what the pursuit reveals about the pursuers.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You need a reason for opposed parties to occupy the same space.',
        'The theme lives in the chase, not in the prize.',
        'Heist, chase, quest, or ensemble structures.',
        'Explaining the object in detail would only invite questions that do not help.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Nobody in the story agrees on what is inside the case. Every character explains why they need it, and each explanation is a confession.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Over-explaining it until the audience expects it to pay off thematically.',
        'Letting it be so arbitrary that the stakes feel weightless.',
        'Forgetting that the characters must believe in it completely, even if the work does not.',
      ],
    },
    { type: 'seeAlso', pages: ['red-herring', 'want-vs-need', 'ticking-clock', 'theme-statement'] },
  ],
};
export default page;
