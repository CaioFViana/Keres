import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'choices',
  title: 'Choices',
  summary: 'Link one scene to another and write the decision that opens each path.',
  keywords: ['choice', 'source scene', 'destination scene', 'path', 'branching'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A choice is the link between two scenes in a branching story: it starts in a Source scene, shows Text, and leads to a Destination scene.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'In “The station door opens,” the reader sees “Follow Mara to the train.” That choice leads to “Inside the train.” Another choice, “Investigate the corridor,” leads to a different scene.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Choices. This menu is only available in branching stories.',
        'Tap + to create a choice, or open one to edit it.',
        'Choose the Source scene and Destination scene, write the Text, and add Choice notes if needed.',
        'Save. After saving a new choice, you can add tags, notes, See also links, conditions, and effects.',
        'Open Story map or Story analysis to check whether the new path makes sense.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'text',
          label: 'Text',
          whatToWrite:
            'Write the option shown to the reader, such as “Follow Mara to the train”. This field is required.',
          note: 'It is the choice name in lists, details, and the map.',
        },
        {
          key: 'sourceScene',
          label: 'Source scene',
          whatToWrite: 'Select the scene where this decision appears. This field is required.',
          note: 'The map draws the outgoing path from this scene.',
        },
        {
          key: 'destinationScene',
          label: 'Destination scene',
          whatToWrite: 'Select the scene this decision leads to. This field is required.',
          note: 'The map draws the incoming path to this scene.',
        },
        {
          key: 'notes',
          label: 'Choice notes',
          whatToWrite:
            'Record the intention, consequence, or a review reminder. It can be left blank.',
          note: 'It appears in the choice details, separate from linked notes.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Each choice creates a link in Story map and is checked by Story analysis. Conditions can hide, block, or enable the choice; effects can change the items and markers used in later decisions.',
    },
    {
      type: 'seeAlso',
      pages: ['branching-basics', 'story-map', 'choice-conditions', 'effects', 'story-state'],
    },
  ],
};
export default page;
