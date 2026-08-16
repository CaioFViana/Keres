import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'app-settings',
  title: 'App settings',
  summary: 'Adjust your local name, language, and Keres appearance on this device.',
  keywords: ['dark mode', 'language', 'local username', 'reset application'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'These settings control the app appearance and local identification. They do not change a story Theme, which is information about the narrative’s subject.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You can use dark mode at night and choose English for the interface while keeping a story whose Theme is “forgiveness”. One choice does not change the other.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'From the main menu, open Settings.',
        'Under User, enter the name that identifies you on this device.',
        'Under Language, choose the interface language. Help follows this choice.',
        'Turn Dark mode on or off to change the app appearance.',
        'Turn 24-hour time on or off to choose how custom Date attributes show and edit their time.',
        'Use Reset application only when you want to erase local data and return to initial setup. Read the confirmation before accepting.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Language and appearance apply throughout this device. Show help controls the contextual help shortcut in supported page headers. The local name is not the same as a server account name, @tag, or profile. Resetting removes local stories, media, and saved connections from this device.',
    },
    { type: 'seeAlso', pages: ['your-profile', 'data-and-backup', 'using-this-help'] },
  ],
};
export default page;
