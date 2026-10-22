import type { HelpPage } from '@/src/content/help/types';
const page: HelpPage = {
  id: 'browse-showcase',
  title: 'Browse a server’s showcase',
  summary:
    'Read, download or keep a copy of what others published on a server, from inside the app.',
  keywords: [
    'showcase',
    'browse',
    'link',
    'paste',
    'download',
    'read online',
    'password',
    'pack',
    'author',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A server can have a public site, its showcase, where people publish stories, authors write a page about themselves and packs are shared. The Showcase in the app shows that same site without leaving the app: you browse it, open a story and choose what to do with it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A friend sends you the link to “The Silent Valley”. Paste it in the Showcase: the story opens, and you can read it online, download its files, or import a copy to your own list.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'paragraph', text: 'To open a link someone gave you:' },
    { type: 'path', segments: ['Main menu', 'Showcase'] },
    {
      type: 'steps',
      items: [
        'Paste the link in the field, or tap the clipboard button. On the web, Ctrl+V anywhere on the screen works too.',
        'The app says whose server it is and what the link points at. A link that is not a showcase page, or not secure, is explained instead of opened.',
        'A link from a server you registered opens as yours. A link from any other server opens as a guest: you can read and download, and nothing of yours is sent. Register that server to sign in and sync with it.',
      ],
    },
    {
      type: 'paragraph',
      text: 'To browse a server you registered, choose it under Your servers. From the story list or a server’s page there is also a Showcase shortcut.',
    },
    {
      type: 'list',
      items: [
        'Stories: search, and narrow by genre, language, structure and form of the work. Each story shows its versions.',
        'Authors: an author’s page has their biography, their links and their stories.',
        'Packs: what a pack brings. Download one to start new stories from it.',
      ],
    },
    { type: 'paragraph', text: 'For each version of a story:' },
    {
      type: 'list',
      items: [
        'Read online opens the server’s own reader in your browser.',
        'Download package saves the Keres file (.zip); Manuscript saves the document the author published.',
        'Import a copy creates a new story in your list from the package, with its own copy of the media.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A story can be protected by a password. The app asks for it before showing anything; after you unlock it, reading, downloading and importing work for about an hour.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Browsing changes nothing on the server or in your stories. An imported copy is a new story, separate from the author’s; importing again creates another one. A downloaded pack is kept on your device and can be applied when you create a story.',
    },
    {
      type: 'seeAlso',
      pages: ['import-export', 'publish-story', 'packs', 'add-server', 'friends'],
    },
  ],
};
export default page;
