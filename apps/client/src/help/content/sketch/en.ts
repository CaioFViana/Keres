import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sketch',
  title: 'Sketches',
  summary:
    'A drawing board for scene ideas and comic roughs: brush, eraser, bucket fill, layers, selection, paper sizes, and export to the gallery. Quick and light, not a painting program.',
  keywords: [
    'sketch',
    'draw',
    'drawing',
    'brush',
    'pen',
    'marker',
    'eraser',
    'fill',
    'bucket',
    'paint',
    'color',
    'eyedropper',
    'lasso',
    'select',
    'move',
    'layer',
    'page',
    'paper',
    'comic',
    'balloon',
    'speech',
    'text',
    'stamp',
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
      text: 'A sketch is a named drawing on a page of paper: a place to note down a scene, a layout, a pose, or a comic page. Pick a tool and it stays armed, so you can draw as many strokes as you like. One finger draws; two fingers pan, zoom and twist the view. The hand tool gives the single finger back to the camera. Unlike a board, a sketch pins no story entities.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You rough out the throne-room standoff in six quick panels on a webtoon page, color the queen’s cloak with the bucket, drop speech balloons on top, and export the page to the gallery to attach it to the scene.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Sketches from the gallery header, add one with + and choose its paper (A4, A5, square, wide or webtoon).',
        'Pick the brush, then set its kind, color, size and opacity in the strip under the tools. Draw as many strokes as you like; the tool stays armed.',
        'Use the eraser to cut strokes, the bucket to fill a closed region, and the eyedropper to reuse a color from the drawing.',
        'Open Layers to add, hide, lock, reorder or merge layers; new strokes land on the active layer.',
        'Undo and redo walk a long history. Save with the checkmark in the header; the arrow reverts to the last save.',
        'Export from the canvas: an .svg, a .png, or save it to the gallery as the sketch image.',
      ],
    },
    { type: 'heading', level: 2, text: 'Drawing tools' },
    {
      type: 'paragraph',
      text: 'The brush has three kinds (pen, marker, highlighter), each with its own size and opacity. The eraser cuts strokes and colored fills where you pass over them; a fill is cut when you lift the pen, and a single undo brings it back. The bucket fills the closed region you tap, reading either every layer or only the active one; raise the tolerance if soft edges leave specks, and close small gaps in the outline if the color leaks. Line, rectangle and ellipse draw with the current brush.',
    },
    { type: 'heading', level: 2, text: 'Selecting and moving' },
    {
      type: 'paragraph',
      text: 'The select tool lassoes drawing on the active layer, or taps a single stroke. Whole strokes mode takes every stroke that is mostly inside the lasso; cut mode slices strokes along the lasso border. Drag the selection to move it, a corner to scale, and the knob above it to rotate. The selection bar flips, duplicates, deletes, reorders and moves it to another layer.',
    },
    { type: 'heading', level: 2, text: 'Text, balloons and stamps' },
    {
      type: 'paragraph',
      text: 'Text, speech balloons and stamps are editable objects that always sit above the drawing layers. A balloon is an ellipse: drag its area, type the words, and resize it from the four corner handles. Drag the dot to point the tail at the speaker; the tail leaves the balloon from the nearest of eight directions around it. Tap an object with the select tool to edit it.',
    },
    { type: 'heading', level: 2, text: 'Layers and page' },
    {
      type: 'paragraph',
      text: 'Layers stack from bottom to top. Each can be hidden, locked, made translucent, reordered, duplicated, merged down or cleared. Bucket fills sit under the strokes of their layer, so the outline always paints over the edge of the color. The page button sets the paper size, the orientation and the background (paper, white, or transparent). The page bounds the export; drawing outside it is allowed, and changing the size never moves the drawing.',
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'A short title for this sketch. Required to save it.',
          note: 'This is how the sketch shows up in the list and in search.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite:
            'Optional note on what the sketch is for (the standoff, panel layout, a pose).',
          note: 'Does not appear on the canvas. Used in the list and in search.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Saving, size and export' },
    {
      type: 'paragraph',
      text: 'Ctrl+Z / Ctrl+Shift+Z work on desktop (B brush, E eraser, G fill, I eyedropper, V select, H hand, [ and ] change the size). A sketch is stored as compact drawing data, not pictures, so it stays light; a very busy page warns you before it reaches its size limit. Export writes an .svg (the drawing as vectors) or a .png (the page as an image, transparent if you chose that background). Saving to the gallery stores a .png as a gallery image and links it as the sketch cover.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Changes you have not saved are kept on this device, per sketch, even if you close the app. They come back with a notice the next time you open it.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'If two people save the same sketch, Keres will not merge the drawings. Keep yours, keep theirs, or keep theirs and save yours as another sketch.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Sketches do not change the story map, the locations or any relation. The only other place a sketch shows up is the gallery image you choose to save, and the sketch list. Saving writes one update for the whole drawing.',
    },
  ],
};
export default page;
