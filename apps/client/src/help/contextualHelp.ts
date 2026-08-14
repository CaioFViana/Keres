import { HelpPageId } from './types';

/** Drawer routes that have a direct reader-facing help page. */
export const screenHelpPage: Record<string, HelpPageId> = {
  StorySelectionMain: 'story-list', ExampleStories: 'example-stories', ImportExport: 'import-export', Settings: 'app-settings',
  ServerManagementDrawer: 'what-is-a-server', FriendshipDrawer: 'friends', MainDashboard: 'story-dashboard', GlobalSearch: 'lists-and-search',
  CharactersStack: 'characters', ChaptersStack: 'chapters', ScenesStack: 'scenes', ChoicesStack: 'choices', LocationsStack: 'locations',
  ItemsStack: 'items', ItemJourneysStack: 'item-journeys', TagsStack: 'tags', WorldRulesStack: 'world-rules', NotesStack: 'notes',
  GalleryStack: 'gallery', CharacterRelationsStack: 'character-relationships', StorySchemaStack: 'custom-attributes', Suggestions: 'suggestions',
  CommentsStack: 'comments', OperationLogStack: 'activity-log', StoryAnalysis: 'story-analysis', StorySettings: 'story-settings',
};
