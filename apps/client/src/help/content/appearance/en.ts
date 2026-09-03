import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'appearance',
  title: 'Story appearance',
  summary: 'Choose the colors used while this story is open.',
  keywords: ['appearance', 'theme', 'colors', 'palette', 'preview'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Story appearance chooses the color theme for the current story. It changes the app surfaces, controls, graphs, and canvases while you work in this story; it is not the narrative theme of the work.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use a cooler palette for a story set in winter or a high-contrast palette when you prefer its readability. The story content remains exactly the same.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Customization', 'Appearance'] },
    {
      type: 'steps',
      items: [
        'Select Theme.',
        'Tap a theme to preview it in the picker and in the component examples below the setting.',
        'Choose Save to make that theme the story default, or close the picker to return to the saved theme.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The selected theme is stored with the story and is applied whenever that story is open. It does not rename or alter story elements, change the device-wide dark mode, or affect another story.',
    },
    { type: 'seeAlso', pages: ['story-settings', 'create-story', 'vocabulary'] },
  ],
};

export default page;
