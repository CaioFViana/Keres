/**
 * A pack packaged with the app, in a specific language.
 *
 * `pack` is deliberately left as `unknown`, for the same reason `ExampleStoryLanguage.story` is:
 * the content comes from `generated/registry.ts` (generated from `content/<slug>/<lang>.json`, with
 * no validation in that step). The real validation happens at installation time, in
 * `ShippedPackService` - the same point that already validates a pack downloaded from a server. A
 * malformed file should fail there, with a clear error, and not in a silent cast here.
 */
export interface ShippedPackLanguage {
  /** The language code, in the same format as the app's locales ('pt', 'en', ...) - from the file name. */
  language: string;
  pack: unknown;
}

/**
 * A shipped pack, in every language it was packaged in.
 *
 * Each language is a separate pack rather than a translation of one: a pack carries a `language`
 * string and the app offers no selector for it, so installing the Portuguese one and the English
 * one leaves two packs on the device. That is deliberate - the two would conflict if applied to the
 * same story, and `findConflicts` says so, because they define the same attribute keys.
 */
export interface ShippedPackEntry {
  slug: string;
  languages: ShippedPackLanguage[];
}
