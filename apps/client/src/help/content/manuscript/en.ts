import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'manuscript',
  title: 'Manuscript',
  summary: 'Write the story itself, scene by scene, and read it as one document.',
  keywords: [
    'manuscript',
    'write',
    'editor',
    'prose',
    'export',
    'bold',
    'italic',
    'reading',
    'list',
  ],
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
      segments: ['Story menu', 'Chapters and scenes', 'Open scene', 'Write manuscript'],
    },
    {
      type: 'steps',
      items: [
        'Open a scene and select Write manuscript (pencil icon in the header, or the Manuscript card).',
        'Write in Write mode. The toolbar above the text applies **bold**, *italic*, __underline__ and ~~strikethrough~~, plus bulleted and numbered lists; what you type stays as typed (a "- " line never becomes a list on its own). To undo a list, tap the list button again with the cursor in it. For dialogue, prefer the long dash — (on phones, long-press the hyphen to find it). Typing stays safe as a local draft until you save. Under the text a counter shows words and characters; a scene holds up to about 30,000 characters (around 5,000 words), the editor warns as you near it, and past it the scene should be split in two.',
        'Switch to Read to preview the formatted page, or to Review to read and answer scene comments: commented passages are marked in the text, and a button shows how many comments the scene has. To comment on a passage, select it, tap Copy and then Comments - the passage is offered as the quote (on the web, selecting is enough).',
        'Open the Manuscript from the narrative elements header (book icon) to read everything in order, search the full text, or export. Open contents, beside the search box, lists the scenes grouped by chapter with its own search and the comment count of each; tap one to jump to it.',
        'In the manuscript, tap a scene title to open the scene, or the pencil beside it to edit its prose. The eye icon toggles pure reading: titles and buttons disappear so nothing steals a tap.',
        'Export (share icon) opens the export screen: start from a preset (e-book, paperback, submission) or pick the format, contents, title page, layout and text treatment yourself. Options a format cannot use are not shown for it.',
      ],
    },
    { type: 'heading', level: 2, text: 'Reading a branching story' },
    {
      type: 'paragraph',
      text: 'In a branching story the manuscript has a View selector above the text: Read a route shows the scenes of one route in order (choose which one beside it), All scenes shows every scene, and Explore scenes reads the way the Story Navigator walks the story - one scene at a time, with its choices shown as unavailable until the reader holds what they need. In Explore, pick a start scene, choose a choice to move on, and use Restart simulation to begin again. Review works in every view, so comments can be read and added while exploring.',
    },
    { type: 'heading', level: 2, text: 'Writing a screenplay' },
    {
      type: 'paragraph',
      text: 'When a work (arc) is a screenplay, its scenes show the place, the cast and the scene heading above the text, and the export offers two more formats: Fountain, the plain-text screenplay format that other programs open, and a PDF set the way the industry sets a script (Courier, a wide left margin, every element at its own indent). Choose the form of the work in the arc, and say whether a place is indoors or outdoors in the location.',
    },
    {
      type: 'paragraph',
      text: 'The script is built from the scenes. A scene that begins with its own heading (INT., EXT. or INT./EXT.) keeps it exactly. One that does not gets a heading written from its location, as INT. KITCHEN, and the screen above the text says which of the two will happen. In the text, each Enter starts a paragraph: write a character name in capitals, then the parenthetical and the speech in the paragraphs right after it, and leave an empty paragraph to end the speech. Everything else is action.',
    },
    {
      type: 'paragraph',
      text: 'The export screen shows how long the script is and, beside it, the paper, the font, the margins and the indents that number stands on. The PDF is set with the same values, so the same paper gives the same pages; other programs break pages by slightly different rules, and their count may differ by a little.',
    },
    {
      type: 'paragraph',
      text: 'A script written elsewhere comes in through Import a script, on the chapters screen of a screenplay: choose a Fountain file and Keres reads it first. Each section becomes a chapter and each scene heading a scene, with the script exactly as written, so it exports back as the same script. The places and the characters it names are only offered, switched off: turn on the ones worth an entry of their own. Places and characters you already have are linked by name either way, and nothing else is created.',
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
