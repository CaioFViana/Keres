/**
 * What the example list shows of a story before it is installed. Copied out of the story's file when
 * the registry is generated (`scripts/lib/exampleStoriesIndex.ts`), so the list does not need the
 * story itself. Left as `unknown` on purpose, like the content: the reader checks what it shows.
 */
export interface ExampleStoryMeta {
  title: unknown;
  description: unknown;
  type: unknown;
  author: unknown;
}

/**
 * An example story packaged with the app, in a specific language.
 *
 * The story itself is not here: it is ~90 KB of JSON, and a bundle that held all of them made everybody
 * download a megabyte for what a few people install once. `load()` brings it in when it is wanted (a
 * separate chunk on the web, inside the app everywhere else).
 *
 * What `load()` resolves to is deliberately `unknown`: the content comes from `generated/registry.ts`
 * (generated from `content/<slug>/<lang>.json`, with no validation at all in that step). The real validation
 * (`FullStoryExportSchema`) only happens at installation time, in `ExampleStoryService` - the same point
 * that already validates a `.json` file chosen by the user in `pickStoryExportFile`. A malformed example
 * file should fail there, with a clear error, and not in some silent cast here.
 */
export interface ExampleStoryLanguage {
  /** The language code, in the same format as the app's locales ('pt', 'en', ...) - it comes from the file name. */
  language: string;
  meta: ExampleStoryMeta;
  load: () => Promise<unknown>;
}

/**
 * An example story, in every language it was packaged in.
 *
 * `slug` comes from the folder name in `content/` and identifies the story across languages -
 * each language is the same "script", but every installation gets a copy with new IDs and
 * internal links remapped. That rule applies to the examples catalogue only.
 */
export interface ExampleStoryEntry {
  slug: string;
  languages: ExampleStoryLanguage[];
}
