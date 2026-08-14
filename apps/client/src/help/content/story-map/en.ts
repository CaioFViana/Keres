import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-map',
  title: 'Story map',
  summary: 'See scenes and choices in a branching story as a navigable diagram.',
  keywords: ['map', 'diagram', 'path', 'start scene', 'end scene', 'choice'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Story map draws every scene in a branching story and the choices that connect them. It helps you see branches, returning paths, and isolated scenes without opening every profile.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You planned two paths after the station. On the map, both arrows leave the same scene, pass through different scenes, and return to the same ending. A third scene without an arrow appears isolated, showing that a choice still needs to reach it.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Choices and tap the map icon in the header.',
        'Drag and zoom the diagram. Use the fit button to bring the whole map back onto the screen.',
        'Use the legend: the Start scene border marks where a path starts; the End scene border marks its ending; dashed lines indicate returning paths.',
        'Tap a scene to see its summary, timing, effects, and incoming or outgoing choices. Tap a connection shown there to move to the matching scene.',
        'Use the labels button to show or hide choice text and the export button to create an image of the map.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'The warning above the diagram reports choices that point to a scene that is not available. Fix the choice or scene before relying on that path.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The map only shows the structure you created: editing a scene or choice updates the diagram. Isolated scenes, endings, and disconnected paths also appear in Story analysis warnings.',
    },
    { type: 'seeAlso', pages: ['branching-basics', 'choices', 'scenes', 'story-analysis'] },
  ],
};

export default page;
