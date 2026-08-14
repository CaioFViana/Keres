import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'custom-attributes',
  title: 'Custom attributes',
  summary: 'Create your own fields for story elements.',
  keywords: ['field', 'attribute', 'default value', 'required'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Custom attributes add fields to forms for an element type, such as Character or Item.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Create “Suspicion level” for Characters, with Number type and a default value of 0.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Custom attributes', '+'] },
    {
      type: 'steps',
      items: [
        'Choose the element type.',
        'Enter Display name and choose Type.',
        'Set Required, Default value, and Order when needed.',
        'Save; the field appears in forms and details for that type.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'displayName',
          label: 'Display name',
          whatToWrite: 'The label writers will see.',
          note: 'It can be edited later.',
        },
        {
          key: 'type',
          label: 'Type',
          whatToWrite: 'Choose Text, Long text, Number, Yes/no, Date, Suggestion, or Entity.',
          note: 'It defines how the value is entered.',
        },
        {
          key: 'targetEntityType',
          label: 'Target entity type',
          whatToWrite: 'For an Entity type, choose what kind of entity it can reference.',
          note: 'It is fixed after creation.',
        },
        {
          key: 'required',
          label: 'Required',
          whatToWrite: 'Turn on if every element of this type needs a value.',
          note: 'Prevents saving without a value.',
        },
        {
          key: 'defaultValue',
          label: 'Default value',
          whatToWrite: 'An initial value for new profiles.',
          note: 'It can change in each profile.',
        },
        {
          key: 'order',
          label: 'Order',
          whatToWrite: 'The position where the field should appear.',
          note: 'Organizes forms and details.',
        },
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'An Entity attribute lets writers select a Character, Location, Item, Scene, Chapter, Note, or World Rule. Its target type is fixed when the attribute is created and it has no default value. If the referenced entity is deleted, the attribute remains but shows as unavailable.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The field appears in forms, details, Advanced Search, and Global Search. Its identity remains the same even if its visible name changes.',
    },
    { type: 'seeAlso', pages: ['suggestions', 'lists-and-search', 'characters'] },
  ],
};
export default page;
