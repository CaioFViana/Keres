import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scene-pages',
  title: 'Pages and frames',
  summary:
    'For comics and storyboards: a scene holds pages (or frames), each an image from a Sketch or the Gallery with its text underneath. Keres is for sketching and planning, not for final art.',
  keywords: [
    'page',
    'pages',
    'frame',
    'frames',
    'panel',
    'comic',
    'storyboard',
    'image',
    'sketch',
    'gallery',
    'text',
    'caption',
    'fit',
    'crop',
    'cover',
    'contain',
    'order',
    'media removed',
    'manuscript',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A scene can hold any number of pages, or frames in a storyboard. A page is one image and the text that goes with it. The image is a Sketch you drew here or a picture from the Gallery. The text is what would be printed under (or beside) the page, so a drawing does not need its balloons filled in: it can carry numbers, and the text says what each one holds.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The scene “Standoff in the throne room” has three pages. Each one is a sketch of the layout, and under each one you write who says what and what the panels show. When you compile the manuscript, the pages come out in order, each with its text.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Set the work’s medium to Comic or Storyboard (arc settings). The scene then offers its pages.',
        'Open the scene, then its pages, and add one with +. Choose Draw a page (a blank sketch in the work’s page size, opened for you), Upload pictures (one or several from your device; each becomes a page, in the order you choose) or, once the story has some, one you already have: a Sketch or an image from the Gallery.',
        'Write the page’s text under it, and choose how the image sits in the frame.',
        'Use the arrows to move a page up or down. Only that page changes, so two people can reorder different pages at the same time.',
        'Compile the manuscript to get the pages, in order, with their text.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'text',
          label: 'Text',
          whatToWrite:
            'What goes with the page: captions, dialogue, a note on what each panel shows. Free text.',
          note: 'Optional. Printed under the page in the manuscript.',
        },
        {
          key: 'fit',
          label: 'Fit',
          whatToWrite:
            'Whole (the entire image is shown) or Fill (the image is cropped, centred, to fill the frame).',
          note: 'Whole is the default. Fill never changes the image itself, only how much of it shows.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Sketches stay up to date' },
    {
      type: 'paragraph',
      text: 'A page that uses a Sketch shows a picture of the drawing. If you edit the Sketch afterwards, Keres notices the picture is out of date and makes a new one before it is used in an export or a release, so the page never shows an old drawing.',
    },
    { type: 'heading', level: 2, text: 'When the image is gone' },
    {
      type: 'paragraph',
      text: 'If the Sketch or the Gallery image is deleted, the page is not lost. It stays with its text and shows “media removed”. Choose a replacement image and the page is whole again. Until then it is left out of any manuscript you make, and you are told how many pages were.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Keres is for sketching and planning. A Sketch or a Gallery picture is a rough to plan with, not final-quality art for printing.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Pages belong to their scene: they move with it when you export the story or clone an example, and they disappear from the manuscript if the scene is deleted. Each page counts toward your plan’s limit on story items. The scene’s own text is unchanged; pages sit alongside it.',
    },
  ],
};
export default page;
