import { HelpPage } from '../../types';

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
    { type: 'seeAlso', pages: ['notes', 'tags', 'gallery', 'character-relationships'] },
  ],
};

export default page;
