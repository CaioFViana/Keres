import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'publish-story',
  title: 'Publish a story',
  summary: "Put one of your stories on a server's public page, where anyone can download it.",
  keywords: ['publish', 'public', 'showcase', 'share', 'download', 'password'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Some servers have a public page listing stories their users chose to publish. Publishing puts a frozen copy of one of your stories there, as a file anyone can download and open in their own Keres.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'This is not publishing a story in the usual sense. What goes on that page is the Keres base of a story - its structure, characters, scenes, notes. Keres is always a companion to the medium the story is actually being made in: a book, a game, a campaign. It is not that medium, and a published version is not a finished work being distributed.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You finished planning “The Glass City” and want other people to be able to look at how it is built, or to start their own version from yours. You publish a version; someone downloads it and imports it into their app.',
    },
    { type: 'heading', level: 2, text: 'Before you can publish' },
    {
      type: 'list',
      items: [
        'The story must belong to you. Stories shared with you, even with permission to write, never appear on this screen.',
        'You must be connected to the story server at that moment.',
        'The story must be fully synced - no local change still waiting to reach the server.',
      ],
    },
    {
      type: 'paragraph',
      text: 'When something is missing, the screen says which of the three it is instead of just refusing.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Main menu', 'Publish story'] },
    {
      type: 'steps',
      items: [
        'Open the story you want to publish on the list.',
        'Choose how the version should be named.',
        'Decide whether it is listed publicly or hidden behind a password.',
        'Choose Create new public version.',
      ],
    },
    { type: 'heading', level: 2, text: 'Version names' },
    {
      type: 'table',
      headers: ['Style', 'Looks like'],
      rows: [
        ['Version + date', 'v12-2026-08-19'],
        ['Version only', 'v12'],
        ['Date only', '2026-08-19'],
      ],
    },
    {
      type: 'paragraph',
      text: 'Publishing twice on the same day with the date-only style adds a number to the second one, so no two versions of a story ever share a name.',
    },
    { type: 'heading', level: 2, text: 'Public or behind a password' },
    {
      type: 'paragraph',
      text: 'A public story appears in the list on the page, for anyone to find. A password-protected story does not appear anywhere: only someone with both the link and the password can open it. That is useful for showing a story to a friend who has no account on that server, without putting it in front of the world.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A password is a shared secret, not a per-person permission. Anyone you give it to can pass it on. To grant access to one specific person and be able to take it back, add them as a reader of the story instead.',
    },
    { type: 'heading', level: 2, text: 'Older versions' },
    {
      type: 'paragraph',
      text: 'The server keeps the five most recent versions of each story. Publishing a sixth removes the oldest one from the page. Your own history in the app is untouched by this.',
    },
    { type: 'heading', level: 2, text: 'Taking something down' },
    {
      type: 'paragraph',
      text: 'You can remove a single version, or unpublish the story entirely and take every version off the page at once. Neither deletes anything from the story itself. Note that people who already downloaded a copy keep the copy they have.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Publishing does not change the story, does not appear in its activity log, and does not affect syncing. People who read or write that story with you are told when a new version is published.',
    },
    { type: 'seeAlso', pages: ['import-export', 'collaborators', 'what-is-a-server'] },
  ],
};
export default page;
