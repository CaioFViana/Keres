import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'location-map',
  title: 'Location map',
  summary: 'Place Locations, images, markers, and connections in your world.',
  keywords: ['map', 'contains', 'connected', 'location', 'marker', 'link'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The Location map is a saved drawing: place Locations over Gallery images, add free markers, and link its points. Between Locations, it can show “contains” for hierarchy and “connected to” for a path or passage.',
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
        'Use Add images for a visual base and Add locations or Marker to place points on the canvas.',
        'Drag points or images to position them; Edit layout exposes size and layer controls.',
        'Turn on Connect nodes in the header and drag from one point to another to create a link.',
        'In the dialog, choose whether the link is directional, its A → B or B → A direction, and optional text.',
        'Open a Location from the map to review its profile, relations, and map destination.',
      ],
    },
    { type: 'heading', level: 2, text: 'Direction, text, and markers' },
    {
      type: 'paragraph',
      text: 'Between two Locations, an undirected link creates “connected to”; a directional link creates “contains”, with the arrow from parent to child. Text is saved only on this map and appears on the line and in the export. Links involving a marker — marker to marker or marker to Location — also stay on this map: markers do not change the story structure.',
    },
    { type: 'heading', level: 2, text: 'Map destinations' },
    {
      type: 'paragraph',
      text: 'A Location or marker can point to another Location map. The small exit icon marks a destination; hold the point until the exit pop appears, then release it to open the other map.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Hierarchy and links between Locations change the story relationships and can appear wherever those relationships are used. Positions, images, markers, text, map destinations, and marker links belong only to this map. Removing a point does not delete the Location or scenes that happen there.',
    },
    { type: 'seeAlso', pages: ['locations', 'scenes', 'boards'] },
  ],
};
export default page;
