import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'locations',
  title: 'Locations',
  summary: 'Describe the spaces where the story happens.',
  keywords: ['location', 'climate', 'culture', 'politics'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Locations are spaces in your world, from continents to rooms. Scenes choose a Location to record where they happen.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Central Station can have a wet climate, merchant culture, and politics divided between two families; these details keep scenes consistent.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Locations', '+'] },
    {
      type: 'steps',
      items: [
        'Create a Location and enter Name.',
        'Use Description for the overall view.',
        'Fill in Climate, Culture, and Politics when they are useful to the narrative.',
        'After saving, link the location to scenes and organize its position on the map.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'Place name. Fill it in to save.',
          note: 'Appears when choosing a scene location.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'What the place is like and what makes it recognizable.',
          note: 'Available in details.',
        },
        {
          key: 'climate',
          label: 'Climate',
          whatToWrite: 'Relevant climate conditions.',
          note: 'Helps keep scenes consistent.',
        },
        {
          key: 'culture',
          label: 'Culture',
          whatToWrite: 'Customs, values, or way of life.',
          note: 'Can guide characters and conflicts.',
        },
        {
          key: 'politics',
          label: 'Politics',
          whatToWrite: 'Powers, rules, or disputes in the place.',
          note: 'Can guide conflicts.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight the location.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Details that do not fit other fields.',
          note: 'They remain in the profile.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Scenes depend on a Location. The map can show locations inside others and path connections. Deleting one requires reviewing scenes that use it.',
    },
    { type: 'seeAlso', pages: ['scenes', 'location-map', 'characters'] },
  ],
};
export default page;
