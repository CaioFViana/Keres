import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'theme-statement',
  title: 'Theme statement',
  summary: 'The argument the work is making, stated as a claim you could disagree with.',
  keywords: ['theme', 'tema', 'thematic statement', 'premise', 'argument', 'meaning'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Not a topic — loyalty, grief — but a proposition: loyalty to a person can be disloyalty to everyone else. Written as a claim, it can be tested by the plot, contradicted by a character, and answered by the ending. It is a tool for the author, and normally invisible to the audience.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Subplots feel unrelated and you need a criterion for keeping them.',
        'The ending is technically correct and emotionally empty.',
        'You must decide which of two versions of a scene to keep.',
        'A collaborator asks what the work is about and you answer with the plot.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Topic: forgiveness. Claim: forgiveness offered too early protects the one who caused the harm. Now every scene can be asked whether it argues, complicates, or ignores that.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Putting the statement into a character mouth as a moral.',
        'Choosing a claim nobody could argue against, which gives the work no opposition.',
        'Deciding the theme first and forcing characters to serve it.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['thematic-mirror', 'want-vs-need', 'motif-and-leitmotif', 'save-the-cat-beat-sheet'],
    },
  ],
};
export default page;
