import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'seven-point-structure',
  title: 'Seven-point structure',
  summary: 'Hook, plot turn 1, pinch 1, midpoint, pinch 2, plot turn 2, resolution.',
  keywords: ['seven point', 'pinch point', 'midpoint', 'plot turn', 'sete pontos', 'outline'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A plotting grid built backwards from the ending. You define the resolution first, then the hook as its opposite, then the two turns that move the character between them, with pinch points where the antagonistic force applies direct pressure and a midpoint where the character stops reacting and starts acting.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You know the ending and cannot find the road to it.',
        'The antagonist disappears for long stretches and the middle goes slack.',
        'You want fewer, load-bearing beats rather than a long outline.',
        'You are planning a series and want each instalment to turn on its own axis.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Hook: a translator who trusts no one. Resolution: she vouches for a stranger in court. The midpoint is where she stops hiding and starts investigating; the pinches are the two times the other side proves it can reach her.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Writing pinch points as reminders that the villain exists instead of as real cost.',
        'Letting the midpoint be an event rather than a change in who is driving.',
        'Designing the seven points and never asking whether the character earned them.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'save-the-cat-beat-sheet', 'character-arc', 'ticking-clock'],
    },
  ],
};
export default page;
