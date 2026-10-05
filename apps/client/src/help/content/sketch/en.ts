import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sketch',
  title: 'Sketches',
  summary:
    'Quick freehand drawings on a page: strokes, shapes, stamps, speech balloons and short texts. A base to continue elsewhere, not a painting program.',
  keywords: [
    'sketch',
    'draw',
    'drawing',
    'pen',
    'stroke',
    'shape',
    'stamp',
    'balloon',
    'speech',
    'text',
    'layer',
    'page',
    'paper',
    'undo',
    'export',
    'svg',
    'png',
    'gallery',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A sketch is a named drawing on a paper page. Pick a pen, a line, a polygon, a rectangle, a text or a stamp, draw, and the tool puts itself away. Speech balloons live behind the shapes button: drag the area, then pull the tail tip toward the speaker. New strokes land on the active layer.',
    },
    { type: 'heading', level: 2, text: 'Page and view' },
    {
      type: 'paragraph',
      text: 'The page button sets the paper size (A4, A5, square, wide, webtoon, or a custom size) and the orientation. The page bounds the export; drawing outside stays allowed. Twisting with two fingers rotates the view around the screen center - the drawing itself never rotates, and the reset button straightens the view back.',
    },
    { type: 'heading', level: 2, text: 'Layers' },
    {
      type: 'paragraph',
      text: 'Layers stack named groups of strokes with their own visibility and opacity. Hidden layers skip the canvas, the hit-testing and the export alike. Deleting a layer deletes its strokes.',
    },
    { type: 'heading', level: 2, text: 'Saving and export' },
    {
      type: 'paragraph',
      text: 'The checkmark saves every change; the arrow reverts to the last save. Undo and redo walk the session history, and Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) work on desktop. Export writes an .svg file (the vector drawing) or a .png file (the page rasterized). Saving to the gallery stores a .png as a gallery image and links it as the sketch cover - outside the canvas, the sketch reads as that image.',
    },
  ],
};
export default page;
