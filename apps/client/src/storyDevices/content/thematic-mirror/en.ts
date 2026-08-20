import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'thematic-mirror',
  title: 'Thematic mirror',
  summary: 'A subplot facing the same dilemma and answering it differently.',
  keywords: [
    'thematic mirror',
    'espelho tematico',
    'subplot',
    'parallel',
    'b story',
    'counterpoint',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A secondary character or storyline placed in a situation structurally identical to the protagonist and allowed to choose otherwise. It lets the work argue with itself: the audience sees a road not taken and its consequences, without anyone explaining the comparison.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A subplot exists and you cannot justify its presence.',
        'The protagonist choice needs a cost that the main plot cannot show.',
        'The theme risks reading as a lecture with only one voice.',
        'An ensemble needs coherence across separate storylines.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The protagonist refuses to testify. Her former colleague testifies, is protected, and loses everyone he knows. Neither outcome is presented as the answer.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Making the mirror so parallel that it reads as a diagram.',
        'Letting the mirrored character be obviously wrong, which removes the argument.',
        'Introducing it late, when there is no room for consequences.',
      ],
    },
    { type: 'seeAlso', pages: ['theme-statement', 'the-foil', 'motif-and-leitmotif', 'flat-arc'] },
  ],
};
export default page;
