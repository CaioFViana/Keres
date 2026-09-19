import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'packs',
  title: 'Packs',
  summary:
    'Reuse a story’s structure — its fields, catalogues, stats and tags — and, when asked, a starter skeleton of its elements.',
  keywords: ['pack', 'template', 'reuse', 'structure', 'starter', 'extras'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A pack is the reusable part of a story: the custom attributes you defined, the suggestion catalogues you saved, the stats and their ladders, and the tags. With the Extras switch on, it also carries a skeleton of the story’s elements — chapters, scenes, characters, locations and the rest — as ordinary starting elements, never the filled-in content: no attribute values, no stat values, no gallery images.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You spent an evening setting up six stats with a ladder from 3 to 18, and a set of fields for every character. The next campaign should start with all of it already in place, without copying anything by hand.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'heading', level: 3, text: 'Making one' },
    { type: 'path', segments: ['Main menu', 'Packs', 'Create a pack'] },
    {
      type: 'steps',
      items: [
        'Choose the story to take the structure from.',
        'Turn on what should come along: custom attributes, tags, stats, suggestion catalogues — and Extras for the starter skeleton.',
        'Give it a name. The language and the author are filled in from that story and can be changed.',
        'Save. The pack is now on this device and can be used by any new story.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'There is no pack editor, on purpose: a pack is made from a story, so everything in it is edited where it already lives. To change a pack, change the story and use Extract again — which raises the pack’s version.',
    },
    { type: 'heading', level: 3, text: 'Using one' },
    { type: 'path', segments: ['Main menu', 'Stories', 'New story'] },
    {
      type: 'steps',
      items: [
        'Start creating a story as usual.',
        'Under Packs, choose one or more.',
        'Each chosen pack that carries a skeleton offers its own Extras switch: on brings the starter elements, off installs structure only.',
        'Create the story. Everything the packs carry is already there.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Packs are only offered while a story is being created. An existing story cannot receive one — its structure is edited directly, in Custom Attributes, Stats and Tags.',
    },
    { type: 'heading', level: 2, text: 'When two packs disagree' },
    {
      type: 'paragraph',
      text: 'Some things cannot exist twice in one story: two custom attributes with the same identification on the same element, two tags with the same name, two default stat ladders, or more primary stats than the radar allows. If the packs you picked collide, Keres says which one before the story is created, and nothing is created until you change the selection.',
    },
    { type: 'heading', level: 2, text: 'Extras' },
    {
      type: 'paragraph',
      text: 'Extras are the starter skeleton: the source story’s chapters, scenes, characters, locations, world rules, notes, boards and maps, with the links between them. They arrive as ordinary elements with their own names, ready to edit — and two packs shipping a chapter with the same name arrive as “Setup” and “Setup (2)” rather than colliding.',
    },
    {
      type: 'paragraph',
      text: 'Two things stay behind on purpose: values filled into forms and stats stay with the writer; and gallery images never travel, so a pack stays small enough to share as text. Scenes filed in no chapter travel as unfiled, exactly as story export carries them.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'An older Keres that does not know extras installs such a pack as structure only, without saying so. Update the app on every device to get the skeleton.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Whatever a pack brings becomes an ordinary part of the new story from the first second: the fields appear in the forms, the tags in the lists, the stats in their screens, and every one of them can be edited or deleted like anything else. Nothing records that a pack was used, and deleting a pack later does not touch the stories made from it.',
    },
    { type: 'seeAlso', pages: ['custom-attributes', 'suggestions', 'tags', 'create-story'] },
  ],
};
export default page;
