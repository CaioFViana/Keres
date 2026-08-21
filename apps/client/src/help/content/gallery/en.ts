import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'gallery',
  title: 'Gallery',
  summary: 'Import images, audio, and video and link them to story elements.',
  keywords: ['image', 'audio', 'video', 'media', 'attachment', 'gallery'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Gallery is the story library for images, audio, and video. Each file is stored once and can be linked to characters, scenes, locations, items, and notes.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You imported a portrait of Captain Mara. Rather than importing the same image again, link it to Mara’s profile and the scene where she appears: both show the same media while the gallery stays organized.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'From the Story menu, open Gallery.',
        'Tap + and choose one or more files. Gallery accepts compatible images, audio, and video.',
        'Open a media item to view or play it, add a Title, and write Extra notes.',
        'Under Linked entities, choose where it should appear and save. You can also add media from an element’s gallery area.',
        'To remove media from an element, remove only its link on that element’s profile. To remove the file from the story, open it in Gallery and choose Delete.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'fileName',
          label: 'File',
          whatToWrite:
            'This is the selected file name. It identifies the media and cannot be changed here.',
          note: 'It appears in the media details and helps with Gallery search and sorting.',
        },
        {
          key: 'mediaType',
          label: 'Media type',
          whatToWrite: 'This comes from the imported file: image, audio, or video.',
          note: 'It determines the thumbnail and the viewer or player used in details.',
        },
        {
          key: 'mimeType',
          label: 'Format',
          whatToWrite:
            'This is the detected file format, such as PNG, MP3, or MP4; it is for reference only.',
          note: 'It can help explain why a file has no preview available.',
        },
        {
          key: 'sizeBytes',
          label: 'Size',
          whatToWrite: 'Shows the storage used by the file; there is nothing to enter.',
          note: 'Larger files use more space when the story is synchronized to a server.',
        },
        {
          key: 'title',
          label: 'Title',
          whatToWrite:
            'Give it a descriptive name, such as “Mara portrait” or “Station sound”. It can be left blank.',
          note: 'Makes media easier to find in Gallery.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Keep context, credits, or a reminder of where to use the media.',
          note: 'They stay in the media details.',
        },
        {
          key: 'linkedEntities',
          label: 'Linked entities',
          whatToWrite:
            'Choose the characters, scenes, locations, items, or notes that should show this media.',
          note: 'Removing a link does not delete the media from Gallery or from other elements.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Mark the star to highlight important media.',
          note: 'It can then be found with Gallery’s favorites filter.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Linked media appears on the profiles of the elements you chose. Removing a link only stops it appearing on that profile; deleting from Gallery removes the file from the story. Media also counts toward storage when you synchronize the story with a server.',
    },
    { type: 'seeAlso', pages: ['favorites', 'lists-and-search', 'sync-basics', 'data-and-backup'] },
  ],
};
export default page;
