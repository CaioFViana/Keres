import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'location-map',
  title: 'Location map',
  summary: 'Organize places inside places and paths between places.',
  keywords: ['map', 'contains', 'connected', 'location'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The location map shows two different relationships: “contains” for hierarchy and “connected to” for a path or passage between two locations.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A Map Room is contained in the Palace; the Palace is connected to the Square by a road. The room does not need to connect to the square to be part of the palace.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Locations', 'Location map'] },
    {
      type: 'steps',
      items: [
        'Create Locations before organizing them on the map.',
        'Open a location to set or remove its parent when you want to indicate “contains”.',
        'On the map, add or remove connections when you want to indicate a path between two locations.',
        'Open a location from the map to review its profile.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Hierarchy and connections help read the map and find related places. Removing a map relationship does not delete the Location or scenes that happen there.',
    },
    { type: 'seeAlso', pages: ['locations', 'scenes'] },
  ],
};
export default page;
