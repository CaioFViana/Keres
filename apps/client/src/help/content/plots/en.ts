import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'plots',
  title: 'Plots',
  summary: 'Group the scenes of one narrative line and see how far it reaches.',
  keywords: ['plot', 'narrative line', 'storyline', 'coverage', 'reader'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A Plot is one narrative line of the story: a set of Scenes that tell the same thread, each with a short note explaining what that Scene does for it. The same Scene can belong to several Plots. Plots exist in linear stories only.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The plot "The captain’s redemption" gathers five scenes spread over three chapters. On the scene "The letter", the note reads "he learns his brother survived".',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Plots', '+'] },
    {
      type: 'steps',
      items: [
        'Name the Plot and, if you want, describe it in Details.',
        'Open a Scene that belongs to it and use the Plots section of the form.',
        'Pick the Plot and write the one-line note about what that Scene does for it.',
        'Go back to the Plot to read its Scenes in narrative order.',
        'Use the Matrix, Coverage and Reader at the top of the list to see the whole set.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'Name the narrative line in a few words. Required to save.',
          note: 'This is how the Plot shows up in lists, in the matrix and in search.',
        },
        {
          key: 'details',
          label: 'Details',
          whatToWrite: 'Explain what this line is about and where it is meant to go.',
          note: 'Shown on the Plot detail screen and searched by the global search.',
        },
        {
          key: 'note',
          label: 'Scene note',
          whatToWrite:
            'In one line, say what that Scene does for this Plot. Required to save the link.',
          note: 'Lives in the Scene form, on the Plot detail screen and in the matrix cells.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Coverage shows how many active Scenes each Plot reaches; because a Scene can belong to several Plots, the percentages do not add up to 100%. Deleting a Plot removes only its links: the Scenes stay untouched. While plots exist, the story cannot be converted to branching.',
    },
    { type: 'seeAlso', pages: ['scenes', 'chapters', 'narrative-elements'] },
  ],
};
export default page;
