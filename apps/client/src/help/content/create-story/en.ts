import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'create-story',
  title: 'Creating and editing a story',
  summary: 'Give a story a name, identity, and preferences before filling it in.',
  keywords: ['title', 'author', 'genre', 'theme', 'create story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'This form creates a story or changes the basic details of one that already exists. Title is the only field you need to fill in to create it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'For “The Glass City”, you can use Fantasy as the genre, credit Marina Alves as the author of an adaptation, choose Portuguese, and keep a note about the version you are planning.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story list', '+', 'Create new story'] },
    {
      type: 'steps',
      items: [
        'Fill in Title.',
        'Choose Type before creating; this form does not change it after the story exists.',
        'Fill in other fields whenever they help you recognize or present the story.',
        'Tap Create story or Update story.',
        'To later change type, collaboration, server, reader comments, scene timing, or favorites, open Story settings.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Title',
          whatToWrite:
            'The name by which you recognize the story. It is the only field needed to create it.',
          note: 'It appears in the story list and header.',
        },
        {
          key: 'type',
          label: 'Type',
          whatToWrite: 'Choose Linear for one sequence or Branching for paths with choices.',
          note: 'Branching makes the Choices menu and story map available.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'A free summary that identifies the story’s premise.',
          note: 'It can appear on the list card.',
        },
        {
          key: 'genre',
          label: 'Genre',
          whatToWrite: 'A narrative genre, such as fantasy, romance, or mystery.',
          note: 'It appears on the list card.',
        },
        {
          key: 'author',
          label: 'Author',
          whatToWrite: 'Who signs the story. It can be different from your account name.',
          note: 'Useful for adaptations and co-authored work.',
        },
        {
          key: 'language',
          label: 'Language',
          whatToWrite: 'The story language.',
          note: 'It helps identify stories in your collection.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn it on to highlight the story.',
          note: 'A star appears on the list card.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Reminders that do not fit other fields.',
          note: 'They remain with story details.',
        },
        {
          key: 'theme',
          label: 'Theme',
          whatToWrite: 'Choose the visual appearance used while the story is open.',
          note: 'This is not the narrative theme of the work.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Type controls branching-story tools. The appearance applies while the story is open. Other details help identify the story without changing its characters or scenes.',
    },
    { type: 'seeAlso', pages: ['story-type', 'story-settings', 'story-list'] },
  ],
};
export default page;
