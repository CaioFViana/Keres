/**
 * What a row in `chapters` is.
 *
 * A **chapter** sits on the story's narrative spine: it carries a number, and that number is the
 * order the story is told in. An **event** is the same container of scenes with the numbering taken
 * off - "The Three Hundred Year War" is a thing that happened in the world, not the fourth thing the
 * reader is shown.
 *
 * One table with a discriminator rather than two tables, because `Scene.chapterId` decides it: a
 * second kind of container would make that a polymorphic parent, and everything that walks
 * scene -> chapter (the timeline, the plot views, the presence matrix, the story graph, analysis,
 * the export) would have to learn about it. See `docs/events_feature_plan.md` section 3.2.
 *
 * The two kinds keep **separate index spaces**, because their indices mean different things: a
 * chapter's is narrative order, an event's is only the order the writer arranged the list in. Where
 * events sit in time is recorded by relations, not by a counter.
 */
export const CHAPTER_TYPES = ['chapter', 'event'] as const;

export type ChapterType = (typeof CHAPTER_TYPES)[number];

/** What a row is when the column predates this feature, and what a new container is unless asked. */
export const DEFAULT_CHAPTER_TYPE: ChapterType = 'chapter';
