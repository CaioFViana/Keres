import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'characters',
  title: 'Characters',
  summary: 'Record who takes part in the story and details that keep them consistent.',
  keywords: ['character', 'biography', 'personality', 'protagonist'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Characters are the people or beings who move the narrative. Their profile gathers identification, description, and planning information.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Lia may have Biography “left the city at sixteen” and Planned timeline “reunites with her sister at the end”. The first records the past; the second is a plan that can still change.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Characters', '+'] },
    {
      type: 'steps',
      items: [
        'Create a profile and fill in Name.',
        'Use description fields when they help you write or revise.',
        'After saving, add Tags, Notes, relationships, scene participation, and See also.',
        'Open the character from the list to edit or consult links.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'How the character will be recognized. Fill it in to save.',
          note: 'Appears in lists, scenes, and relationships.',
        },
        {
          key: 'title',
          label: 'Title',
          whatToWrite: 'A role, form of address, or nickname if relevant.',
          note: 'Helps distinguish characters.',
        },
        {
          key: 'gender',
          label: 'Gender',
          whatToWrite: 'The gender identity you want to record.',
          note: 'May suggest previously used values.',
        },
        {
          key: 'race',
          label: 'Race',
          whatToWrite: 'The character’s species or people.',
          note: 'May suggest previously used values.',
        },
        {
          key: 'subrace',
          label: 'Subrace',
          whatToWrite: 'A more specific division when it exists.',
          note: 'May suggest previously used values.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'Appearance or general presentation.',
          note: 'Useful when consulting the profile.',
        },
        {
          key: 'personality',
          label: 'Personality',
          whatToWrite: 'How the person tends to think, feel, or react.',
          note: 'Does not replace Qualities or Weaknesses.',
        },
        {
          key: 'motivation',
          label: 'Motivation',
          whatToWrite: 'What the character wants or why they act.',
          note: 'Helps review decisions in scenes.',
        },
        {
          key: 'qualities',
          label: 'Qualities',
          whatToWrite: 'Strengths, virtues, or abilities.',
          note: 'Can contrast with Weaknesses.',
        },
        {
          key: 'weaknesses',
          label: 'Weaknesses',
          whatToWrite: 'Limits, flaws, or vulnerabilities.',
          note: 'Can create narrative conflict.',
        },
        {
          key: 'biography',
          label: 'Biography',
          whatToWrite: 'Facts that already happened before the current moment.',
          note: 'Different from Planned timeline.',
        },
        {
          key: 'plannedTimeline',
          label: 'Planned timeline',
          whatToWrite: 'Events you intend to develop.',
          note: 'It is a plan, not an established fact.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn it on to highlight this profile.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Details that do not fit other fields.',
          note: 'They remain in the profile.',
        },
        {
          key: 'relationType',
          label: 'Relation type',
          whatToWrite:
            'This is a search-only field. Choose a relation type to find characters connected by that type of relationship.',
          note: 'It searches the character’s relationships and does not add a field to the character profile.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Characters can take part in scenes, form relationships, receive tags, notes, media, and comments. Deleting a profile removes its availability in those links; review them first.',
    },
    { type: 'seeAlso', pages: ['character-relationships', 'scenes', 'tags', 'comments'] },
  ],
};
export default page;
