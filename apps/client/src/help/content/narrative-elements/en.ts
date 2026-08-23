import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'narrative-elements',
  title: 'Narrative Elements',
  summary:
    'Plan chapters, scenes, and, in branching stories, the choices between scenes in one place.',
  keywords: ['narrative', 'chapters', 'scenes', 'choices', 'story map'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Narrative Elements is the story workspace for its structure. Chapters group scenes; scenes hold the events; branching stories connect scenes with choices.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'It keeps the story structure and its navigation together, so you can move from an overview to a chapter, scene, or choice without changing workspaces.',
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A chapter called “Arrival” can contain the scenes “At the station” and “The first meeting”; in a branching story, choices connect that meeting to the paths that follow.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Create a chapter, then add scenes inside it.',
        'Expand a chapter to review and open its scenes.',
        'In a linear story, open the timeline from the header; in a branching story, add choices from a scene and open the story map there.',
        'Use search and filters to find a chapter, scene, or choice without leaving this workspace.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The advanced search separates Chapter, Scene, and Choice fields. Choice fields are shown only in branching stories. Scene timing also feeds the timeline in linear stories.',
    },
    { type: 'seeAlso', pages: ['chapters', 'scenes', 'choices', 'story-map', 'lists-and-search'] },
  ],
};

export default page;
