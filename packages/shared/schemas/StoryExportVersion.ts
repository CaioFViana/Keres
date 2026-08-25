/**
 * Version of the story export format (`FullStoryExportType`), independent of the app's version
 * number (client/api/package.json are not a single source of truth today).
 *
 * It is only bumped manually when an official release changes the exported package's format - not on
 * every commit/build.
 */
export const CURRENT_STORY_FORMAT_VERSION = 6;
