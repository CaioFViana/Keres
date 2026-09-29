import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'manuscript',
  title: 'Manuscript',
  summary: 'Write the story itself, scene by scene, and read it as one document.',
  keywords: ['manuscript', 'write', 'editor', 'prose', 'export', 'bold', 'italic', 'reading'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The manuscript is the actual prose of the story, written inside Keres instead of another app. Each scene holds its own body of text, and the manuscript screen joins every scene into a single reading document.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: '“Leaving the station” has a one-line summary for planning and three paragraphs of prose for reading. The scene editor holds the prose; the manuscript shows it together with every other scene, in story order.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'path',
      segments: ['Story menu', 'Narrative Elements', 'Open scene', 'Write manuscript'],
    },
    {
      type: 'steps',
      items: [
        'Open a scene and select Write manuscript (pencil icon in the header, or the Manuscript card).',
        'Write in Write mode. The toolbar above the text applies **bold**, *italic*, __underline__ and ~~strikethrough~~; typing stays safe as a local draft until you save.',
        'Switch to Read to preview the formatted page, or to Review to read and answer scene comments.',
        'Open the Manuscript from the narrative elements header (book icon) to read everything in order, search the full text, or export.',
        'In the manuscript, tap a scene title to open the scene, or the pencil beside it to edit its prose. The eye icon toggles pure reading: titles and buttons disappear so nothing steals a tap.',
        'Export (share icon) opens the export screen: start from a preset (e-book, paperback, submission) or pick the format, contents, title page, layout and text treatment yourself. Options a format cannot use are not shown for it.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Prose travels with the scene in sync and backups. Export builds Word, PDF, EPUB, HTML, Markdown or plain-text files - the same on every device and when publishing to the showcase. PDF uses a standard serif font, so text outside Western alphabets (Chinese, Arabic, emoji) does not show in it; EPUB and Word keep it; a branching story exports as a whole gamebook: every scene a choice can reach from the start (or from each start, when there are several, with an opening page to pick one), numbered as the reader meets them or scattered like a printed gamebook, with each choice pointing at the number or page of its target - scenes nothing seems to lead to close the book. Fragments without a chapter and scenes of event containers can be included as an appendix or left out of the export.',
    },
    {
      type: 'seeAlso',
      pages: ['scenes', 'chapters', 'comments', 'choices', 'routes', 'import-export'],
    },
  ],
};
export default page;
