import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'in-late-out-early',
  title: 'In late, out early',
  summary: 'Start the scene as close to the conflict as possible, and leave before the tidying up.',
  keywords: ['in late out early', 'entre tarde saia cedo', 'scene entry', 'cut', 'editing', 'trim'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Enter each scene after the greetings and the walk to the table, and cut it the moment its purpose is served, ideally one line before the audience expects. The gaps are filled by the audience at no cost, and the work moves.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Revising: nearly every scene in a first draft starts a page too early.',
        'Dialogue keeps arriving at the point through polite scaffolding.',
        'You want the next scene to inherit the tension of this one.',
        'The medium punishes dead time, as in screen or comics.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Cut the arrival, the coat, the coffee. Begin on: "You told them." End on her reaching for her phone, before we see whom she calls.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Cutting so early that the audience loses the geography of the scene.',
        'Removing every beat of rest until the work is exhausting.',
        'Ending on a false note of mystery when the scene had already finished.',
      ],
    },
    { type: 'seeAlso', pages: ['scene-and-sequel', 'in-media-res', 'pacing', 'cliffhanger'] },
  ],
};
export default page;
