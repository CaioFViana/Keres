import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'data-and-backup',
  title: 'Your data and backup',
  summary: 'Protect stories with exports and understand what remains on a device or server.',
  keywords: ['backup', 'data', 'export', 'uninstall'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Stories are stored on the device. When you send a story to a server, a copy of it and its media can synchronize to let you access it on other devices and collaborate.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Before changing devices, you export a copy of “The Station” and keep the file somewhere safe. Later you can import it as a new story.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'From the main menu, open Import and export.',
        'Choose the story and export a copy to a place you control.',
        'To recover a copy, import the file; importing creates a new local story.',
        'Before resetting or uninstalling the app, export local stories you want to keep.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Exporting does not alter the original story. Uninstalling or resetting the app can remove local data; a synchronized story can remain on the server, but an export is the most direct way to keep an independent copy.',
    },
    { type: 'seeAlso', pages: ['import-export', 'sync-basics', 'troubleshooting'] },
  ],
};
export default page;
