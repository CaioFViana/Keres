import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scene-music',
  title: 'Music in a scene',
  summary:
    'A scene can have music: a song you wrote in the app, or a recording or a link from the Gallery, with a note of when it comes in and whether the people in the story hear it. The words of a song sung in the story can go into an export; recordings and links never do.',
  keywords: [
    'music',
    'song',
    'soundtrack',
    'score',
    'cue',
    'ambience',
    'audio',
    'link',
    'playlist',
    'gallery',
    'in the story',
    'role',
    'scene',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A scene can have any number of pieces of music. Each one points at a song of the story (see “Songs”) or at an audio file or a link you keep in the Gallery, and carries two notes: when it comes in, and whether the people in the story hear it. It works in every kind of work: a comic can have a soundtrack, a screenplay its music cues, a campaign the music at the table, and a novel the song someone sings in a tavern.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The scene “The tavern fight” has two pieces of music. One is a playlist link, marked as soundtrack, that comes in “when the first chair breaks”. The other is a recording of the song the bard sings, marked as heard in the story.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Write the song in Songs, or add the audio file or the link to the Gallery of the story.',
        'Open the scene, then its music, and add one with +. Choose the song, the file or the link.',
        'For a song, choose which of its parts the scene sings, or leave it whole.',
        'Say whether it is heard in the story or is soundtrack, and write when it comes in.',
        'Use the arrows to move a piece up or down.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'role',
          label: 'Heard in the story or soundtrack',
          whatToWrite:
            'Heard in the story: the people in the scene hear it, because someone sings it, plays it or has it on. Soundtrack: only whoever tells the story hears it, like the music under a comic scene or the music at the table during a fight.',
          note: 'The same music can be one thing in one scene and the other in another. Soundtrack is the default for a recording or a link.',
        },
        {
          key: 'sections',
          label: 'Which parts it sings',
          whatToWrite:
            'For a song: the parts of it this scene sings, by the names they have in its words (“Chorus”). Leave it empty for the whole song.',
          note: 'If a part is renamed or deleted, the rest is printed; if none is left, the whole song is. Story Analysis tells you.',
        },
        {
          key: 'cue',
          label: 'When it comes in',
          whatToWrite:
            'A line of direction: “as she opens the door”, “cuts at the scream”. Free text.',
          note: 'Optional. In a screenplay export it goes in as a note that does not print.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'When the file is gone' },
    {
      type: 'paragraph',
      text: 'If the file or the link is deleted from the Gallery, the music is not lost. It stays with its note and shows “removed”. Choose something else for it, or delete it. Story Analysis tells you about music that points at something that is gone.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The music belongs to its scene: it moves with it when you export the story or clone an example. Each piece counts toward your plan’s limit on story items. Recordings and links from the Gallery are never published; they are for you. The words of a song heard in the story can be printed after the scene or in an appendix when you export or publish, if you choose to; soundtrack is never printed.',
    },
  ],
};
export default page;
