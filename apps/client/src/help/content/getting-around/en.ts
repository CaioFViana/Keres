import { HelpPage } from '../../types';

const page: HelpPage = { id: 'getting-around', title: 'Navigating the app', summary: 'Use the menu that fits the part of your work you are in.', keywords: ['menu', 'back', 'phone', 'wide screen'], blocks: [
  { type: 'heading', level: 2, text: 'What it is' },
  { type: 'paragraph', text: 'Keres has two menus. The main menu handles stories and your account; the story menu shows the elements and tools for the story that is open.' },
  { type: 'heading', level: 2, text: 'What it is for' },
  { type: 'example', title: 'Example', text: 'Before opening a story, you use the main menu to import a backup. After opening “The Glass City”, you use the story menu to reach Characters, Scenes, and Story Analysis.' },
  { type: 'heading', level: 2, text: 'How to do it' },
  { type: 'steps', items: ['On a wide screen, use the visible menu on the left; drag its edge to adjust its width.', 'On a phone, tap the menu icon in the header to open the drawer.', 'Tap a menu item to return to that subject’s main list.', 'Use your device or browser Back button to return through the screens you opened.', 'Tap Help at the bottom of the menu to search or browse the catalog.'] },
  { type: 'heading', level: 2, text: 'What it affects elsewhere' },
  { type: 'paragraph', text: 'Opening a story changes the available menu but does not alter your data. Going back to Story Selection leaves the story intact and lets you open another one.' },
  { type: 'seeAlso', pages: ['story-list', 'using-this-help', 'lists-and-search'] },
] };
export default page;
