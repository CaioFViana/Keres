import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'arcs',
  title: 'Arcs, volumes and phases',
  summary:
    'Organize one story into books, phases or other large sections without splitting its world.',
  keywords: ['arc', 'arcs', 'volume', 'volumes', 'phase', 'chapters', 'events', 'theme'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A story is a universe, and an arc is one work inside it: a book, a film, an issue, a season or a campaign module. The story still has one shared cast, world, calendar and set of notes, so a character can live through every work.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Every story begins with one default arc. It gives every chapter and event somewhere to belong, so you never need to set one up before you can write.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'Use arcs when the same world needs clearer editorial boundaries. They let you focus lists and views on one book or phase while characters, places and other shared material remain available throughout the story.',
    },
    {
      type: 'example',
      title: 'A trilogy in one story',
      text: 'Create an arc for each book of a trilogy. Assign each chapter to its book. A character introduced in the first book remains the same character in the second, while the chapter lists and narrative views can stay focused on the book you are revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Customization', 'Arcs'] },
    {
      type: 'steps',
      items: [
        'Open Customization from the story menu and choose Arcs.',
        'Choose Add to create another arc, then give it a clear name.',
        'Optionally add a description, pick an Icon (search the library or choose from the recent ones) and choose a theme for that arc.',
        'Open a chapter or event and choose the arc it belongs to.',
        'Use the arc selector in the story header when you want to focus on one arc.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Name',
          whatToWrite: 'A name for the book, phase or other section.',
          note: 'Use a name that remains clear when selecting the arc from a chapter or event.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'A short note about the purpose, period or focus of this arc.',
          note: 'Optional; it can help distinguish similar sections while planning.',
        },
        {
          key: 'medium',
          label: 'Form of the work',
          whatToWrite:
            'Choose what this work is: prose, screenplay, comic, storyboard or tabletop campaign.',
          note: 'It picks friendlier terms and the right export for this arc. It never limits what you can add, and you can change it at any time.',
        },
        {
          key: 'author',
          label: 'Author of this work',
          whatToWrite: "Who wrote this work, if it differs from the story's author.",
          note: "Left empty, the story's author is used, and then your handle.",
        },
        {
          key: 'coverGalleryId',
          label: 'Cover',
          whatToWrite: 'Pick an image from the gallery to stand for this work.',
          note: 'Optional. It does not copy or move the image.',
        },
        {
          key: 'pageFormat',
          label: 'Page format',
          whatToWrite:
            'For a comic or a storyboard: the shape of the frame a page picture is shown in (A5, US comic book, B5 manga or widescreen).',
          note: 'Optional. Left alone, the medium chooses (a comic uses the US comic book page, a storyboard 16:9).',
        },
        {
          key: 'themeOverride',
          label: 'Theme',
          whatToWrite: 'Choose a theme for this arc, or leave it using the story theme.',
          note: 'The theme changes the appearance while this arc is selected; it does not change the story theme.',
        },
      ],
    },
    {
      type: 'paragraph',
      text: "While an arc is selected, the vocabulary screen edits that arc's own terms. A term left empty uses the story's term, and then the default for the arc's form of the work.",
    },
    { type: 'heading', level: 2, text: 'Comics, storyboards and campaigns' },
    {
      type: 'paragraph',
      text: 'In a comic or a storyboard, each scene can hold pages (or frames) with a picture and their text, and the arc sets the frame the pictures are shown in. In a tabletop campaign, the New session button on the chapters screen asks only for the real date and opens the session with its first scene ready. The campaign pack adds a date field, tags and starter notes if you want them; nothing requires it, and a campaign exports as a chronicle by default.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Chapters and events belong to one arc. Scenes, characters, places and items remain shared through the story, and are shown in an arc when they appear through those chapters or events. Removing an extra arc moves its chapters to the default arc instead.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'The default arc cannot be removed. It is the safe destination for chapters when another arc is removed.',
    },
    { type: 'seeAlso', pages: ['chapters', 'scene-pages', 'appearance', 'story-settings'] },
  ],
};

export default page;
