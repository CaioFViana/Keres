import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'location-map',
  title: 'Location map',
  summary: 'Place Locations, images, markers, and connections in your world.',
  keywords: [
    'map',
    'contains',
    'connected',
    'location',
    'marker',
    'link',
    'trajectory',
    'path',
    'shape',
    'stamp',
    'draw',
  ],
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
        'Above the map, Add background image gives it a visual base, and Add locations and Add marker place points on the canvas.',
        'Drag points or images to position them; Edit layout exposes size and layer controls.',
        'Turn on Connect nodes above the map and drag from one point to another to create a link. Connect nodes, Edit objects and Edit layout are exclusive: turning one on turns the others off.',
        'In the dialog, choose whether the link is directional, its A → B or B → A direction, and optional text.',
        'Open a Location from the map to review its profile, relations, and map destination.',
        'Save with the checkmark in the header; the undo arrow (Revert) goes back to the last saved map.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Changes you have not saved are kept on this device, per map, even if you close the app. The next time you open the map they come back with a notice; if the saved map changed in the meantime the notice says so, and Revert drops your draft.',
    },
    { type: 'heading', level: 2, text: 'Shapes, lines, and stamps' },
    {
      type: 'paragraph',
      text: 'Add objects (shapes icon) draws over the map: rectangles, ellipses, frames, lines, polygons, ready-made shapes and stamps (an icon). It works exactly as on a board: drag for rectangles, ellipses, frames and ready-made shapes; tap each point of a line or polygon and choose Finish; tap once for a stamp. Edit objects selects one to move it, reshape it, lock it, change its layer, or open its details (label, color, dashed or filled). Nothing drawn changes Locations or relations.',
    },
    { type: 'heading', level: 2, text: 'Trajectories' },
    {
      type: 'paragraph',
      text: 'Show trajectories (footsteps icon) draws the path of a character or an item over the map, from one Location point to the next in story order. Pick who to follow in the sheet - several characters and items at once - and in a branching story also the Route the path follows. Clear selection hides them.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A trajectory is worked out from the scenes where the character appears (or the item journey) and the Location each scene happens in; nothing is saved on the map, and the selection is forgotten when you leave. Stops whose Location is not on this map are counted in a chip (“2 stops off this map”) instead of being drawn.',
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
      text: 'Hierarchy and links between Locations change the story relationships and can appear wherever those relationships are used. Positions, images, markers, text, map destinations, and marker links belong only to this map. Removing a point does not delete the Location or scenes that happen there. Shapes, lines and stamps belong only to this map and are included when you export it as PNG or SVG.',
    },
    {
      type: 'seeAlso',
      pages: ['locations', 'scenes', 'boards', 'characters', 'item-journeys', 'app-settings'],
    },
  ],
};
export default page;
