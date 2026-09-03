import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'routes',
  title: 'Routes',
  summary: 'Define a possible path through a branching story, then read or simulate that path.',
  keywords: ['route', 'path', 'choice', 'reader', 'navigator', 'branching'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A Route is a possible path you author in a branching story. It records the starting Scene and, at each step, which Choice leads to the next Scene. It is not a copy of the story and does not alter its Choices.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The route “Mara takes the train” starts at the station, chooses “Follow Mara”, and ends at the arrival. You can open it in the Reader to review only that path without travelling through the other branches.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Plots', 'Routes'] },
    {
      type: 'steps',
      items: [
        'In a branching story, open Plots and then Routes.',
        'Create the Route, give it a name, and save it. Then open Edit steps.',
        'Choose the starting Scene. For every following Scene, the screen offers only the Choices that actually leave the current Scene.',
        'End the Route when you reach an ending, or continue through another available Choice.',
        'Use the Route Reader to read the chosen path, and Story Navigator to try Choices, conditions and effects without saving a Route.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'Give the path a recognisable name, such as “Alliance ending”.',
          note: 'Required; it appears in the Routes list and Reader.',
        },
        {
          key: 'details',
          label: 'Notes',
          whatToWrite:
            'Describe the narrative intention, ending, or audience for this path. It can stay empty.',
          note: 'It does not change Scenes or Choices.',
        },
        {
          key: 'sceneId',
          label: 'Scene',
          whatToWrite: 'Choose the Scene where each route step occurs.',
          note: 'The first is the starting Scene; later Scenes are determined by the previous Choice.',
        },
        {
          key: 'selectedChoiceId',
          label: 'Choice taken',
          whatToWrite:
            'Select the Choice that takes this Scene to the next one, or end the Route here.',
          note: 'The screen does not allow jumping to a Scene without a valid Choice between them.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A Route does not change the map, Scenes, or Choices. The Reader uses only its steps. If a Choice is deleted or starts leading to another Scene, the Route is marked for repair before it can be read.',
    },
    { type: 'seeAlso', pages: ['branching-basics', 'choices', 'story-map', 'story-state'] },
  ],
};

export default page;
