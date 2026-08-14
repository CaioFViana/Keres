import { HelpSection } from './types';

export const helpSections: HelpSection[] = [
  { id: 'start', titleKey: 'help_section_start', pageIds: ['what-is-keres','first-story','how-keres-organizes','getting-around','lists-and-search','using-this-help'] },
  { id: 'stories', titleKey: 'help_section_stories', pageIds: ['story-list','create-story','story-type','story-settings','story-dashboard','story-analysis','import-export','example-stories'] },
  { id: 'elements', titleKey: 'help_section_elements', pageIds: ['characters','character-relationships','chapters','scenes','scene-timing','locations','location-map','items','item-journeys','world-rules','notes','tags','gallery','favorites'] },
  { id: 'branching', titleKey: 'help_section_branching', pageIds: ['branching-basics','choices','story-map','choice-conditions','effects','story-state'] },
  { id: 'annotate', titleKey: 'help_section_annotate', pageIds: ['comments','see-also','custom-attributes','suggestions'] },
  { id: 'preferences', titleKey: 'help_section_preferences', pageIds: ['app-settings'] },
  { id: 'accounts', titleKey: 'help_section_accounts', pageIds: ['what-is-a-server','add-server','your-profile','change-password','friends','collaborators','account-limits'] },
  { id: 'sync', titleKey: 'help_section_sync', pageIds: ['sync-basics','sync-conflicts','activity-log'] },
  { id: 'support', titleKey: 'help_section_support', pageIds: ['troubleshooting','data-and-backup','glossary','faq'] },
];

export const helpPageIds = helpSections.flatMap(section => section.pageIds);
