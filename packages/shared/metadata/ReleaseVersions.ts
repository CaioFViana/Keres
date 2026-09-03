/**
 * The numbers a release decides, in one place.
 *
 * Every constant here is bumped **by hand, in an official release**, and never by a build or a
 * commit. Keeping them together means the release checklist has one file to read instead of three
 * scattered literals - which is not hypothetical: the example-story builder pinned the story format
 * as a literal `6` and quietly fell a version behind, and the only thing that noticed was a guard
 * that fires after the packages are already stale.
 *
 * **Not in `AppRelease.ts`**, deliberately. That file is machine-written: `bun run version:set`
 * rewrites it whole from a template, so anything added to it disappears at the next release. It
 * holds the app's identity, which the tool owns; this holds the compatibility numbers, which people
 * own.
 *
 * Each is re-exported from the module that explains what it means - `StoryExportVersion.ts` and
 * `SyncProtocol.ts` - so call sites keep importing from the place that documents them.
 */

/**
 * Version of the story export package (`FullStoryExportType`).
 *
 * Bump it when a release changes the shape of what an export carries, and add the matching
 * migration in `storyExportMigrations.ts`. An older Keres refuses a package from a newer format
 * rather than guessing at it.
 */
export const CURRENT_STORY_FORMAT_VERSION = 9;

/**
 * Version of the synchronization protocol: what client and server exchange, and the rules each end
 * assumes the other applies.
 *
 * Bump it when a release changes something an older peer would get wrong - a new entity in the
 * payload, a column that starts arriving null, a rule the server begins to enforce. Most releases
 * do not touch it, which is the whole reason it is separate from the app's version.
 *
 * These two numbers move **only in an official release**, never in ordinary development. Schema
 * work on this branch (nullable `Scene.chapterId`, Gallery `document`/`link` + `sourceUrl`) waits
 * for that bump; raising them here would cut off peers and invalidate example stories mid-cycle.
 *
 * **2** - `Scene.locationId` became nullable. A client on 1 declares `location_id TEXT NOT NULL`
 * locally, so a pull carrying a null fails the insert and wedges that story's synchronization in a
 * retry loop with no way out from inside the app. `ChapterAnchor` and the container `type` column
 * arrived in the same release; those an older peer merely ignores, but the null it cannot survive.
 * 
 * **3** - Branching and linear are compatible with each other's features, so older clients can acuse
 * not accepting something it should.
 */
export const SYNC_PROTOCOL_VERSION = 3;

/**
 * The oldest synchronization protocol this build still understands.
 *
 * Raise it only in the release that stops being able to serve the older shape: that is the moment
 * old peers are cut off, and it should be a decision rather than a side effect of bumping the line
 * above.
 *
 * Raised to **2** with the lines above.
 */
export const MIN_SUPPORTED_SYNC_PROTOCOL = 3;
