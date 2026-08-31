import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'vocabulary',
  title: 'Vocabulary',
  summary: 'Rename the core concepts of one story without changing its data or structure.',
  keywords: ['terms', 'rename', 'character', 'scene', 'item', 'world rule', 'choice', 'grammar'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Vocabulary lets a story use its own names for core concepts. For example, a comic can call Characters “Heroes”, Scenes “Pages”, Items “Artifacts”, and Choices “Decisions”. The underlying entity types, IDs, sync, exports, and packs do not change.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A comic can name Characters “Heroes”, Scenes “Pages”, Items “Artifacts”, and Choices “Decisions” while keeping all of Keres’ normal features.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Customization', 'Vocabulary'] },
    {
      type: 'steps',
      items: [
        'Choose the language in which you want to write the vocabulary.',
        'For each concept, enter both its singular and plural name, or leave both blank to keep Keres’ normal wording.',
        'In Portuguese, choose the grammatical gender so surrounding messages agree with the term.',
        'Save the vocabulary. It immediately changes labels in the relevant screens, search, activity log, and related controls.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'language',
          label: 'Vocabulary language',
          whatToWrite:
            'Choose Portuguese or English, matching the language in which you are naming the story concepts.',
          note: 'When the app is shown in the other language, Keres uses its normal translated terms instead of mixing languages.',
        },
        {
          key: 'singular',
          label: 'Singular',
          whatToWrite: 'One instance of the concept, such as “Artifact” or “Decisão”.',
        },
        {
          key: 'plural',
          label: 'Plural',
          whatToWrite: 'Several instances of the concept, such as “Artifacts” or “Decisões”.',
          note: 'Singular and plural must be filled together.',
        },
        {
          key: 'gender',
          label: 'Gender',
          whatToWrite: 'For Portuguese, choose masculine, feminine, or neutral.',
          note: 'It only controls agreement in surrounding Portuguese copy; it does not change the name you entered.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What can be renamed' },
    {
      type: 'table',
      headers: ['Concept', 'Examples'],
      rows: [
        ['Character', 'Hero, detective, player character'],
        ['Location', 'Setting, realm, place'],
        ['Chapter and Event', 'Episode, issue, historical period'],
        ['Scene', 'Page, beat, encounter'],
        ['Item', 'Artifact, card, resource'],
        ['World Rule', 'Lore entry, canon rule'],
        ['Choice', 'Decision, option, branch'],
      ],
    },
    {
      type: 'paragraph',
      text: 'Item Journey is derived from Item. If Item becomes “Artifact”, Keres says “Artifact journey” rather than asking you to maintain a second name.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The selected terms appear in the relevant lists, forms, details, search, activity log, and related controls. Item Journey derives its visible name from Item.',
    },
    { type: 'heading', level: 3, text: 'What it does not do' },
    {
      type: 'list',
      items: [
        'It does not rename stored entity types, custom-attribute targets, URLs, or synchronization operations.',
        'It does not translate your vocabulary into another language for you.',
        'It does not rename a concept globally across every story; vocabulary belongs to the current story only.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'You can safely change or clear vocabulary later. Leaving a pair empty restores Keres’ standard term for that concept; no story content is converted or lost.',
    },
    { type: 'seeAlso', pages: ['custom-attributes', 'items', 'choices', 'world-rules'] },
  ],
};

export default page;
