import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kill-the-mentor',
  title: 'Kill the mentor',
  summary: 'Remove the support so the protagonist must stand alone.',
  keywords: ['kill the mentor', 'matar o mentor', 'mentor death', 'loss', 'independence', 'crisis'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Taking away the figure who has been answering the protagonist questions — by death, betrayal, absence, or simple failure — at the moment their guidance is most needed. The removal converts inherited competence into a decision the protagonist must own.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The protagonist has become a passenger in their own story.',
        'The audience needs to feel that no one is coming.',
        'A lesson must be tested rather than repeated.',
        'You need grief that also changes the structure, not only the mood.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The senior nurse retires mid-crisis, not dramatically: she simply is not on the rota anymore, and the decision is now on someone who never made one.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Killing a mentor the audience never had time to value.',
        'Using death as a shortcut for character development that was never written.',
        'Removing the mentor and then supplying an identical replacement.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'role-reversal', 'character-arc', 'the-wound'] },
  ],
};
export default page;
