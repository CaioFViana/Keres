import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'chapter-hook',
  title: 'Chapter hook',
  summary: 'First and last lines engineered to pull the audience across the gap.',
  keywords: ['chapter hook', 'gancho de capitulo', 'first line', 'last line', 'opening', 'closing'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The sentence that opens a unit and the sentence that closes it, treated as deliberate work rather than as whatever the draft happened to leave there. The last line creates a reason to continue; the first line pays for the decision to do so.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Revising: read only the first and last line of every chapter in sequence.',
        'Serialised or episodic release, where the gap is real time.',
        'A chapter is good but nobody remembers it, because it starts and ends on housekeeping.',
        'You want to change tone or viewpoint and need a clean handoff.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'End: "The second envelope had her handwriting on it." Begin the next chapter: "She had been dead for eleven years."',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Hooks that promise something the next chapter does not deliver.',
        'Ending every chapter on a question until the audience stops asking.',
        'Opening on a strong line disconnected from the scene that follows.',
      ],
    },
    { type: 'seeAlso', pages: ['cliffhanger', 'in-late-out-early', 'pacing', 'bookending'] },
  ],
};
export default page;
