import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'songs',
  title: 'Songs',
  summary:
    'Write the songs of your story as lead sheets: the lyrics with their chords, in sections, with a translation if it is sung in another language. A scene can sing a whole song or only its chorus. You can also write its tune and hear it hummed.',
  keywords: [
    'song',
    'songs',
    'lyrics',
    'chords',
    'chordpro',
    'lead sheet',
    'verse',
    'chorus',
    'bridge',
    'section',
    'transpose',
    'syllables',
    'tempo',
    'key',
    'meter',
    'translation',
    'melody',
    'hymn',
    'lullaby',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A song is a piece of music with words: a tavern song, a hymn, a lullaby. You write its lyrics as a lead sheet — the words, with the chords in square brackets right before the syllable they fall on — and mark its sections: verses, chorus, bridge. It is kept as plain text in a common format (ChordPro), so it reads without the app and any other tool that knows the format can open it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The bard sings “The Lantern Song” in the tavern scene, and only its chorus in the funeral scene. You write the song once; each scene says which sections it sings. When you publish, the lyrics can go at the end of the scene or in an appendix of songs.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Songs from the Gallery and add a song with its title.',
        'Write the lyrics. Put a chord in square brackets before the syllable it falls on: [G]Night de[Em]scends.',
        'Add the verses and the chorus with the buttons above the lyrics. Each section gets a name in the language of the story, written into the text, so changing the language of the app never renames it; two sections cannot share one.',
        'Switch to Sheet to see the chords over the words, and count the syllables if you want a check on the meter.',
        'In a scene, open its music, add the song and choose which sections the scene sings.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Title',
          whatToWrite: 'What the song is called.',
          note: 'Required.',
        },
        {
          key: 'lyrics',
          label: 'Lyrics',
          whatToWrite:
            'What is sung, with the chords in square brackets and the sections marked: {start_of_verse: Verse 1} … {end_of_verse}, {start_of_chorus: Chorus} … {end_of_chorus}. A middle dot (·) between syllables marks them exactly for the counter and is never printed.',
          note: 'In whatever language the song is sung, a made-up one included. Up to 16,000 characters.',
        },
        {
          key: 'lyricsTranslation',
          label: 'Translation',
          whatToWrite:
            'For a song sung in another language: the same words in yours, under the same section marks, with no chords.',
          note: 'Optional. It is only read, never sung. When you publish you choose to print the sung words, the translation or both.',
        },
        {
          key: 'melody',
          label: 'Melody',
          whatToWrite:
            'The notes of the tune, in ABC notation: C D E2 z, a lowercase letter for the octave above, ^ for a sharp, _ for a flat, /2 for half the length, z for a rest. P:Verse 1 starts the tune of a section.',
          note: 'Optional. One note for each syllable, in order. A section with no tune of its own sings the tune of the section of its kind before it, so a ballad of many verses is written once. Up to 8,000 characters.',
        },
        {
          key: 'notes',
          label: 'Notes',
          whatToWrite:
            'What the song is for: who sings it, the culture it comes from, its meter and rhyme.',
          note: 'Optional. Never published.',
        },
        {
          key: 'key',
          label: 'Key',
          whatToWrite: 'The key the chords are written in: G, Em, Bb.',
          note: 'Optional. Transposing moves it with the chords.',
        },
        {
          key: 'tempo',
          label: 'Tempo',
          whatToWrite: 'Beats per minute, from 20 to 300.',
          note: 'Optional. It sets how long the song is said to run.',
        },
        {
          key: 'meter',
          label: 'Meter',
          whatToWrite: 'Beats in a bar and the note that gets one: 4/4, 3/4, 6/8.',
          note: 'Optional. A song has one tempo and one meter.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Sections' },
    {
      type: 'paragraph',
      text: 'A scene names the sections it sings by their labels. If you rename or delete a section afterwards, the scene prints what is still there; if nothing it named is left, it prints the whole song, and Story Analysis tells you. Two sections with the same name cannot be told apart, so the editor offers to number them.',
    },
    { type: 'heading', level: 2, text: 'The tune, and hearing it' },
    {
      type: 'paragraph',
      text: 'In the Tune tab, tap a part to write its tune: have one suggested from its words, or play the notes on a keyboard (the notes can also be written as text). The big button hums the tune with a synthetic voice (a hum, “ah” or “la”) while the words follow line by line; you can add a click, or an instrument — guitar, harp, piano or violin — that plays the chords of the lyrics in a feel of its own (waltz, ballad, march, lullaby). Without a tune, the instrument plays the chords alone, a bar to each. For each section the panel says how many notes there are for its syllables; syllables are only estimated, so a difference is a hint, not an error.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'The sound is made on your device when you press play, and kept for next time. It is a sketch to hear a tune by, not a recording: it sings no words. You can also take the tune out as a MIDI file or an ABC file (with the words under the notes).',
    },
    { type: 'heading', level: 2, text: 'Moving it to another key' },
    {
      type: 'paragraph',
      text: 'Transpose moves every chord, the key and the notes of the tune, by a semitone at a time. The words are never touched.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Write your own lyrics. For someone else’s song, keep a link in the Gallery instead: a lyric you paste here can end up in your published story.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A song belongs to the story, and the scenes that sing it point at it. Deleting it does not lose those notes: the scenes show it as removed until you choose another. Each song counts toward your plan’s limit on story items. Songs travel with the story when you export it, and you can export one song as a ChordPro file.',
    },
  ],
};
export default page;
