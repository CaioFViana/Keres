/**
 * Version of the story export format (`FullStoryExportType`), independent of the app's version
 * number.
 *
 * The number itself lives in `metadata/ReleaseVersions.ts` alongside the other constants a release
 * bumps by hand, so the release checklist has one file to read. It is re-exported here because this
 * is where importers expect to find it, and where the format it describes is defined.
 */
export { CURRENT_STORY_FORMAT_VERSION } from '../metadata/ReleaseVersions';
