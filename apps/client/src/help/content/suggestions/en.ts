import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'suggestions',
  title: 'Suggestion lists',
  summary: 'Organize suggested values for repeated fields in a story.',
  keywords: ['suggestion', 'gender', 'race', 'relationship', 'value', 'list'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Suggestion lists store values you can reuse in repeated fields, such as character gender and race, relationship type, item state, and custom attributes of the Suggestion type.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Rather than typing “Navigator” with different spellings on every profile, save it as an occupation suggestion. When filling in another character, select it and keep the story organized consistently.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Suggestions.',
        'Choose the list you want. Its label shows the element type and field that will use those values.',
        'Enter a new value and tap Add.',
        'Use the pencil to correct a value or the trash icon to remove it. Only someone who can edit the story can make those changes.',
        'When filling in a profile, open the matching field and choose a suggested value, or write another one when appropriate.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The selected list appears in the forms that use that field. Changing a list does not rewrite values already saved on profiles; it only changes the options offered in future edits.',
    },
    {
      type: 'seeAlso',
      pages: ['custom-attributes', 'characters', 'character-relationships', 'items'],
    },
  ],
};

export default page;
