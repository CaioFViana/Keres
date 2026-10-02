import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-analysis',
  title: 'Story analysis',
  summary: 'Find narrative links that may need review.',
  keywords: ['analysis', 'isolated scene', 'broken choice', 'warning', 'reachability', 'progress'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Analysis checks story structure and shows warnings about relationships that look incomplete or contradictory. A quick set of checks appears as soon as you open the screen; a deeper check, covering whether every scene and choice can actually be reached, only runs when you ask for it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'If a choice leads to a removed scene, analysis points to that choice so you can choose another destination or delete it.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Story analysis'] },
    {
      type: 'steps',
      items: [
        'Open analysis. The quick warnings load right away.',
        'Use the control at the top to choose whether unreferenced elements are reported. Confirm saves the choice; Cancel leaves the story unchanged.',
        'For a branching story, tap Check reachability & choice logic to also look for scenes and choices that can never actually be reached.',
        'Wait for the progress bar to finish, or tap Cancel to stop it.',
        'Read each warning and open the indicated element.',
        'Correct the link, scene, choice, or field when the observation makes sense.',
        'Run the check again to confirm the result.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'The deeper check can take a while on a large branching story, so it does not run on its own - press the button whenever you want an up-to-date result. Only one can run at a time, and leaving the screen stops it.',
    },
    { type: 'heading', level: 2, text: 'How many things the story holds' },
    {
      type: 'paragraph',
      text: 'The chart button at the top right opens a second screen that counts everything in the story, type by type: characters, scenes, choices, tags, media files, and custom fields and stats. Below that, a second card lists the links between them (a tag applied to a character, a character placed in a scene) and the values of custom fields and stats; it is only for information. Each type has its own icon, and the bar beside it shows how it compares with the biggest one.',
    },
    {
      type: 'steps',
      items: [
        'Open the story analysis and tap the chart button at the top right.',
        'Read the total at the top: it is every item of the story, except favorites and comments.',
        'Tap NAME or QUANTITY to sort the list; tap the same one again to reverse the order.',
      ],
    },
    {
      type: 'paragraph',
      text: 'The first card is the same count a server plan uses to limit how much one story can hold: what you create, but not the links and values of the second card, nor the story itself, favorites and comments. For a story that is only on this device, nothing limits it and the screen just tells you what is there. For a story linked to a server, the screen also shows the plan name and how far you are from its limits, for example 251 / 500 for this story, and the total across all the stories the plan covers when it has one. The bar turns to a warning color from 90% of a limit, and to the alert color from 95%.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'The plan comes from the server, so it is missing while you are offline. The count itself is always shown, and it includes what has not synchronized yet.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A warning changes nothing on its own. Correcting an element updates scenes, choices, maps, and searches that use it.',
    },
    { type: 'heading', level: 2, text: 'What Keres reports, and what it leaves to you' },
    {
      type: 'paragraph',
      text: 'Some findings are about your story being broken: a choice pointing at a scene that no longer exists, a scene nothing can reach, a chapter numbering the app cannot reorder. Those are always reported.',
    },
    {
      type: 'paragraph',
      text: 'Others are about elements that exist without being used anywhere - a location in no scene, a character with no relationships, an unused tag. Whether those are problems is your call, not Keres’s: in a world bible, a place nobody has visited yet is simply a place. They are off by default and can be turned on with Report unreferenced elements at the top of this screen. Confirm the change before leaving it.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A field you marked as required is still reported when empty, whatever that setting says: that is a rule you set, not an opinion of the app.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'story-map', 'story-type'] },
  ],
};
export default page;
