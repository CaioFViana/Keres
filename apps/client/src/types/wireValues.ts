/**
 * The fields of a synchronized row as the protocol carries them. The shared schema types an operation's `data`
 * as `z.record(z.string(), z.any())` (the shape depends on the entity, and the server validates it per
 * entity), so the values are already `any` before this app can narrow them. Naming the bag once keeps
 * `Record<string, any>` out of the code that only moves it from the wire to a table and back.
 */
// `unknown` does not fit here: a typed entity (an interface) is not assignable to an index signature of
// `unknown`, only to one of `any`, and the callers hand entities and rows to this bag as they are.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WireValues = Record<string, any>;
