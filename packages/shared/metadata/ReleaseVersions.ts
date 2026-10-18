/**
 * The numbers a release decides, in one place.
 *
 * Every constant here is bumped **by hand, in an official release**, and never by a build or a
 * commit. Keeping them together means the release checklist has one file to read instead of three
 * scattered literals - which is not hypothetical: the example-story builder pinned the story format
 * as a literal `6` and quietly fell a version behind, and the only thing that noticed was a guard
 * that fires after the packages are already stale.
 *
 * **Not in `AppRelease.ts`**, deliberately. That file holds the app's identity, which the
 * tool owns (`bun run version:set` stamps its `name` and `version` fields in place), next to the
 * release phrase and the credits, which people own; this holds the compatibility numbers, which
 * people own too but for a different reason - the format and the wire, not the release's face.
 *
 * Each is re-exported from the module that explains what it means - `StoryExportVersion.ts`,
 * `SyncProtocol.ts` and `PackSchemas.ts` - so call sites keep importing from the place that
 * documents them.
 */

/**
 * Version of the story export package (`FullStoryExportType`).
 *
 * Bump it when a release changes the shape of what an export carries, and add the matching
 * migration in `storyExportMigrations.ts`. An older Keres refuses a package from a newer format
 * rather than guessing at it.
 *
 * **11** - `Scene.body`: the scene's own manuscript text, written in the editor. Older packages
 * carry no such key; migration gives every scene an explicit `null`, which is exactly what they
 * were - a scene described by its summary, with no prose behind it. A Keres on 10 would parse a
 * package from 11 and quietly drop every written scene, hence the bump rather than a silent default.
 *
 * **12** - What 1.10 added to a story: `songs`, `storySketches`, `scenePages` and `sceneMusic` (the
 * pictures of a scene and the music it keeps), the Arc's medium, author, cover, page format and
 * vocabulary, a Story's `isNsfw` and cover, and a Location's `intExt`. Older packages carry none of
 * them; migration gives every collection an explicit empty list and every field the value a story
 * had without it. A Keres on 11 would parse a package from 12 and quietly drop every song, sketch,
 * page and piece of music - the story would come back without them and nothing would say so.
 */
export const CURRENT_STORY_FORMAT_VERSION = 12;

/**
 * Version of the pack content payload (`PackContentType`).
 *
 * Bump it when a release changes the shape of what a pack carries, and add the matching
 * migration in `packContentMigrations.ts`. An older Keres refuses a pack from a newer format
 * rather than guessing at it; the listing merely degrades, it never breaks.
 *
 * **2** - `extras`: element skeletons (chapters, scenes, characters, locations, world rules,
 * notes, boards, location maps, and their join rows) carried alongside the schema.
 */
export const CURRENT_PACK_FORMAT_VERSION = 2;

/**
 * Version of the synchronization protocol: what client and server exchange, and the rules each end
 * assumes the other applies.
 *
 * Bump it when a release changes something an older peer would get wrong - a new entity in the
 * payload, a column that starts arriving null, a rule the server begins to enforce. Most releases
 * do not touch it, which is the whole reason it is separate from the app's version.
 *
 * These two numbers move **only in an official release**, never in ordinary development:
 * raising them mid-cycle cuts off peers and invalidates example stories.
 *
 * **2** - `Scene.locationId` became nullable. A client on 1 declares `location_id TEXT NOT NULL`
 * locally, so a pull carrying a null fails the insert and wedges that story's synchronization in a
 * retry loop with no way out from inside the app. `ChapterAnchor` and the container `type` column
 * arrived in the same release; those an older peer merely ignores, but the null it cannot survive.
 *
 * **3** - Branching and linear are compatible with each other's features, so older clients can acuse
 * not accepting something it should.
 *
 * **4** - Arc added, that alone is worth raising, but minimum is also raised as some internal code
 * for API/Syncing changed way too much. fully reworked. Just this once and to be safe, Version 4
 *
 * **5** - Positions became per-row ranks (`rules/rank.ts`): a move is an ordinary edit of the row
 * that moved, and `index`/`order` are derived on each side. The protocol has no container order
 * any more; a peer on 4 would send one and never see a rank change, so it cannot share a story.
 *
 * **6** - Arc rework: Arc system now controls everything the story is. So better to bump it.
 * As change was BIG to how 1.10 works, better bump to 6.
 *
 * It also carries what else 1.10 put on the wire: `Song`, `Sketch`, `ScenePage` and `SceneMusic` are
 * new entities (a peer on 5 would have no table for them), and `Location.intExt` and the Arc's
 * medium, author, cover, page format and vocabulary are new columns.
 */
export const SYNC_PROTOCOL_VERSION = 6;

/**
 * The oldest synchronization protocol this build still understands.
 *
 * Raise it only in the release that stops being able to serve the older shape: that is the moment
 * old peers are cut off, and it should be a decision rather than a side effect of bumping the line
 * above.
 *
 * Raised to **6** with the lines above.
 */
export const MIN_SUPPORTED_SYNC_PROTOCOL = 6;
