import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'see-also',
  title: 'See also',
  summary: 'Create a free, mutual link between two related elements.',
  keywords: ['relate', 'link', 'connect', 'cross-reference', 'see also'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'See also creates a reference between two elements in the same story. The link is mutual: if a character points to a location, that location also shows the character.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Link Mara to the Observatory because the location matters to her story. This does not say she is there in every scene and does not replace a tag; it simply leaves a useful reference on both profiles.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the profile for a character, scene, location, item, note, or another element with a See also section.',
        'Open See also and select the related elements in the picker.',
        'The selection is applied immediately. Remove an item from the picker to remove its link.',
        'In an element’s details, tap a relation to open the matching profile.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Use Tags to group many elements under a short word and Notes to keep text. Use See also when the important part is navigating from one profile to another.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The relation appears in the details of both elements and lets you navigate between them. Removing the link does not delete either element, note, tag, or media item.',
    },
    {
      type: 'heading',
      level: 2,
      text: 'Automatic links are not the same thing',
    },
    {
      type: 'paragraph',
      text: 'A story can also link element names wherever they appear in its text, without you marking anything. That is a separate setting - Link mentions automatically, in Story Settings - and it only changes how text is read: nothing is saved, and turning it off returns every mention to plain text.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'See also is a link you made on purpose and it lives on both profiles. An automatic link is Keres noticing a name while you read, and it disappears the moment the setting is off or the name changes.',
    },
    { type: 'seeAlso', pages: ['notes', 'tags', 'gallery', 'character-relationships'] },
  ],
};

export default page;
