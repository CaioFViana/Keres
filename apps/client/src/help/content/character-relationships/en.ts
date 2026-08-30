import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'character-relationships',
  title: 'Character relationships',
  summary: 'Record links between people and see how the cast connects.',
  keywords: ['relationship', 'graph', 'family', 'rivalry'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Relationships link two characters and describe their bond, such as family, friendship, rivalry, or mentorship.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'By recording Lia as Omar’s rival and Noa’s mentor, you can open the map and notice that Noa still does not connect to the rest of the cast.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Characters and tap the relationships icon in the header to see the map.',
        'To create or change a relationship, open a saved character profile.',
        'Choose the other character and enter the relationship type.',
        'Save the profile and return to the map to check the link.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'relatedCharacter',
          label: 'Related character',
          whatToWrite:
            'Choose the other character in the relationship. You cannot choose the same character.',
          note: 'When editing, this character stays the same to preserve the existing relationship.',
        },
        {
          key: 'relationType',
          label: 'Relationship type',
          whatToWrite:
            'Write or choose the bond name, such as friendship, rivalry, family, or mentorship.',
          note: 'The app can suggest a value already used in this story.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The relationship appears in both character profiles and on the map. Removing a relationship does not delete either character or their scene participation.',
    },
    { type: 'seeAlso', pages: ['characters', 'scenes', 'story-analysis'] },
  ],
};
export default page;
