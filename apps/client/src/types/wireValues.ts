/**
 * The fields of a synchronized row as the protocol carries them. The shared schema types an operation's `data`
 * as `z.record(z.string(), z.any())` (the shape depends on the entity, and the server validates it per
 * entity), so the values are already `any` before this app can narrow them. Naming the bag once keeps
 * `Record<string, any>` out of the code that only moves it from the wire to a table and back.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WireValues = Record<string, any>;
