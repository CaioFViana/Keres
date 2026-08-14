import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scenes',
  title: 'Scenes',
  summary: 'Plan each event, where it happens, and who takes part.',
  keywords: ['scene', 'location', 'chapter', 'participants', 'start', 'end'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A scene records an event in the story. It belongs to a chapter, takes place at a Location, and can bring together characters.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: '“Leaving the station” belongs to the chapter The Journey, takes place at Central Station, and brings Lia and Omar together. Mark it as Start scene if it begins a branching story.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Scenes', '+'] },
    {
      type: 'steps',
      items: [
        'Create the scene and enter Name.',
        'Choose the Chapter and Location; a location must be filled in.',
        'Use Summary to record the event.',
        'After saving, add participating characters, tags, notes, media, and relationships.',
        'Mark Start scene or End scene when it represents a story path.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'A recognizable name for the event. Fill it in to save.',
          note: 'Appears in lists, choices, and maps.',
        },
        {
          key: 'summary',
          label: 'Summary',
          whatToWrite: 'What happens in this scene.',
          note: 'Helps review the sequence.',
        },
        {
          key: 'chapter',
          label: 'Chapter',
          whatToWrite: 'The chapter where readers encounter the scene.',
          note: 'Defines grouping and reading order.',
        },
        {
          key: 'location',
          label: 'Location',
          whatToWrite: 'Where the scene happens. Choose an existing Location.',
          note: 'It is needed to save and connects the scene to the world.',
        },
        {
          key: 'isStart',
          label: 'Start scene',
          whatToWrite: 'Turn on when this starts a branching path.',
          note: 'The map and analysis use this mark.',
        },
        {
          key: 'isEnd',
          label: 'End scene',
          whatToWrite: 'Turn on when this ends a path.',
          note: 'Analysis warns if an end scene still has outgoing choices.',
        },
        {
          key: 'gap',
          label: 'Gap',
          whatToWrite: 'The time that passed since the previous scene.',
          note: 'Also select the unit beside the value.',
        },
        {
          key: 'duration',
          label: 'Duration',
          whatToWrite: 'How long this scene lasts.',
          note: 'Also select the unit beside the value.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight the scene.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Story or production reminders.',
          note: 'They remain in the scene profile.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Scenes appear in their chapter, Location, character participation, and Choices. Start and end scenes affect the map and analysis warnings.',
    },
    {
      type: 'seeAlso',
      pages: ['chapters', 'locations', 'scene-timing', 'choices', 'story-analysis'],
    },
  ],
};
export default page;
