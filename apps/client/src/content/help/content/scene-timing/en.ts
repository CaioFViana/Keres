import type { HelpPage } from '@/src/content/help/types';
const page: HelpPage = {
  id: 'scene-timing',
  title: 'Scene time and rhythm',
  summary: 'Record time between scenes and how long each event lasts.',
  keywords: ['interval', 'duration', 'time', 'normalize'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Interval is the time that passes since the previous scene. Duration is how long the scene itself takes. You enter a value and unit, from seconds to eons.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Timeline',
      text: 'Scene 1: the meeting lasts 1 hour. Scene 2: the journey begins 2 days later and lasts 3 hours. In Scene 2, Interval is 2 days; Duration is 3 hours.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the scene you want to adjust.',
        'Enter the Interval since the previous scene and select a unit.',
        'Enter the scene Duration and select a unit.',
        'In Story settings, use normalize time when you want to recalculate the sequence from these values. The time can be shown as 26 hours or as 1 day and 2 hours.',
      ],
    },
    { type: 'heading', level: 2, text: 'Fixed date' },
    {
      type: 'paragraph',
      text: 'By default a scene comes after the previous one, measured by its Interval. When you know exactly when a scene happens, set a fixed date on it: pick the calendar (the story’s primary one by default, or Gregorian), then the day, month, year and time, or tap the calendar button to choose on a month grid. A fixed date replaces the Interval for placing the scene on the timeline; the Duration still counts. It only places the scene when the story has a primary calendar and a start date (see Calendars). The scene’s detail shows the fixed date.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Time and rhythm help compare the scene sequence and are used when normalizing the story. They do not change chapter reading Order.',
    },
    { type: 'seeAlso', pages: ['scenes', 'chapters', 'story-settings'] },
  ],
};
export default page;
