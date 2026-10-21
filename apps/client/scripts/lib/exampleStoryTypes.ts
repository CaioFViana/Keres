/**
 * A row, or a nested document, of the example story as the build assembles it: fields added one at a time from the
 * authored JSON, with a shape that depends on the entity. Nothing here can name every entity's columns, and does not
 * need to - `test/content/exampleStories.test.ts` validates the result against the schemas once it is built. Naming
 * the loose shape once keeps `Record<string, any>` out of every function that only passes rows along.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExampleRow = Record<string, any>;
