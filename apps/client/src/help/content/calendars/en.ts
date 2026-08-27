import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'calendars',
  title: 'Calendars of your world',
  summary: 'Give the story its own months, weeks and eras, and see dates in them.',
  keywords: ['calendar', 'date', 'era', 'month', 'week', 'season', 'moon', 'agenda', 'time'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A calendar describes how your world counts time: how many months a year has, how long each one is, how many days make a week, and which eras years are counted from. You can also give it seasons and moons.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A calendar only changes how time is read back. It never changes anything you have already written, so you can add one, edit it or delete it at any point without losing a word.',
    },
    {
      type: 'paragraph',
      text: 'Scenes still record their interval and duration exactly as before — a number and a unit, like "3 months". What the calendar decides is how long three of your months actually are.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'Two things. First, the app stops guessing: without a calendar it assumes a week of seven days and a year of about 365, which is wrong for most invented worlds. Second, once you say when the story opens, the timeline can label every scene with a date in your own calendar instead of only telling you how much time has passed.',
    },
    {
      type: 'example',
      title: 'A year of ten months',
      text: 'Your world has ten months of thirty days and a six-day week. You write that down as a calendar, and say the first scene happens on the 1st of Thaw, year 3019 of the Third Age. From then on the timeline reads "14 Harvest, 3019 T.A." beside each scene, and a gap of "2 months" counts sixty days rather than sixty-one.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story settings', 'Calendars'] },
    {
      type: 'steps',
      items: [
        'Open Story settings and choose Calendars.',
        'Choose New calendar and give it a name.',
        'Add your months, each with a name and how many days it has. The year is however long they add up to — the screen tells you the total as you type.',
        'Say how many days a week has. Naming the days is optional; leave it empty or name every one of them.',
        'Open the extra options if your world also has its own clock, eras, seasons or moons. Everything there can be left alone.',
        'Save. Your first calendar becomes the main one automatically.',
        'Back on the Calendars screen, fill in when the story opens. Until you do, the timeline shows elapsed time but no dates.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'months',
          label: 'Months',
          whatToWrite: 'A name and a number of days for each one, in order.',
          note: 'The name may be left blank; the month is then shown by its number.',
        },
        {
          key: 'daysPerWeek',
          label: 'Days in a week',
          whatToWrite: 'How many days pass before the cycle repeats.',
        },
        {
          key: 'eras',
          label: 'Eras',
          whatToWrite: 'A name, a short form, and the year the era begins.',
          note: 'Years are then counted from the era they fall in, as in "3019 T.A."',
        },
        {
          key: 'seasons',
          label: 'Seasons',
          whatToWrite: 'A name and the day of the year it starts on.',
          note: 'Shown beside dates. Nothing in the story is ever written in seasons.',
        },
        {
          key: 'moons',
          label: 'Moons',
          whatToWrite: 'How many days a full cycle takes, and one day the moon was new.',
          note: 'The app works out every other phase from those two numbers.',
        },
        {
          key: 'epoch',
          label: 'When the story opens',
          whatToWrite: 'The date of the first scene, in the main calendar.',
          note: 'Leave it empty and no dates appear anywhere. Nothing else stops working.',
        },
      ],
    },
    { type: 'heading', level: 3, text: 'More than one calendar' },
    {
      type: 'paragraph',
      text: 'A story can hold several. One of them is the main calendar: it is the one the timeline and the agenda are drawn in, and the one that decides what a month or a week is worth. The others are alternative readings of the same moment — useful when two peoples in your world count time differently.',
    },
    { type: 'heading', level: 3, text: 'The agenda' },
    {
      type: 'paragraph',
      text: 'Once the story has a calendar and an opening date, the agenda shows a month at a time with the scenes and events that fall on each day. Its buttons move to the next scene and the next event rather than to the next month, because a story spanning centuries has a great many empty months and none of them are worth paging through.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The timeline measures gaps and durations with the main calendar and labels its rows with dates. Scene and chapter screens read their times back the same way, including the normalize option in Story settings. Custom attributes gain a field type for dates in your calendar, kept apart from the ordinary date field so historical fiction can still record real dates.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Renaming a month after you have dated things changes how those dates are written, not which day they fall on. Nothing moves.',
    },
    { type: 'seeAlso', pages: ['scene-timing', 'story-settings', 'custom-attributes', 'chapters'] },
  ],
};
export default page;
