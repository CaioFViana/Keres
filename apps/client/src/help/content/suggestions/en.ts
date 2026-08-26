import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'suggestions',
  title: 'Suggestion lists',
  summary: 'Organize suggested values for repeated fields in a story.',
  keywords: [
    'suggestion',
    'gender',
    'race',
    'relationship',
    'value',
    'list',
    'named list',
    'copy',
    'rename',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Suggestion lists store values you can reuse in repeated fields, such as character gender and race, relationship type, item state, and custom attributes of the Suggestion type. You can also create named lists of your own that are not tied to a field.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Rather than typing “Navigator” with different spellings on every profile, save it as an occupation suggestion. For colors, weapons, or other vocabularies that are not a built-in field, create a named list and copy values into the lists that should share them.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Suggestions'] },
    {
      type: 'steps',
      items: [
        'Choose the list you want. Native and custom lists are labeled with the element type and field. Lists you created are labeled with their name, and a short field key appears under the title — the same kind of key custom attributes show, not the internal identifier.',
        'Enter a new value and tap Add.',
        'Tap a value to open its details. There you can see every entity that uses it, rename it, or remove it from saved values. Only someone who can edit the story can make those changes.',
        'When renaming, choose whether to also update every current use in the story. Renaming to a value that already exists merges them: all current uses are changed and the old saved value is removed.',
        'Use the plus icon to create a named list. Type a display name and save.',
        'On a named list, use the pencil in the toolbar to rename it. That changes only the name you see in the list and in the story history. The field key stays the same.',
        'Use the copy icon to copy stored values into other lists. Only unique values are added; values already present in the destination are skipped. The lists are not kept in sync afterwards.',
        'Use the trash icon on a named list to delete that list and every value stored in it. Native and custom field lists cannot be deleted here.',
        'When filling in a profile, open the matching field and choose a suggested value, or write another one when appropriate.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Editing a new value on a profile field also works. Native and custom lists include both the values stored here and every unique value already used on that field. If no profile still uses a value that was never stored in Suggestions, it disappears from future suggestions until you add it again. Named lists only keep the values you stored; they do not pick up live field usage.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The selected list appears in the forms that use that field. Removing a value only removes it from the saved catalog; existing uses remain. Renaming can optionally rewrite every current use, and every changed entity is recorded in the operation log. Creating, renaming, or deleting a named list is recorded under the list’s display name, not under an internal identifier.',
    },
    {
      type: 'seeAlso',
      pages: ['custom-attributes', 'characters', 'character-relationships', 'items'],
    },
  ],
};

export default page;
