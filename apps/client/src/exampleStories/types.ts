/**
 * An example story packaged with the app, in a specific language.
 *
 * `story` is deliberately left as `unknown`: the content comes from `generated/registry.ts` (generated
 * from `content/<slug>/<lang>.json` by `scripts/generate-example-stories-index.js`,
 * with no validation at all in that step). The real validation (`FullStoryExportSchema`) only
 * happens at installation time, in `ExampleStoryService` - the same point that already validates
 * a `.json` file chosen by the user in `pickStoryExportFile`. A malformed example file
 * should fail there, with a clear error, and not in some silent cast here.
 */
export interface ExampleStoryLanguage {
  /** The language code, in the same format as the app's locales ('pt', 'en', ...) - it comes from the file name. */
  language: string;
  story: unknown;
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
