/**
 * Where inside a scene a moment sits.
 *
 * Three named places rather than a percentage, and that is a usability decision rather than a
 * shortcut. A percentage is a number the writer has to work out and then **maintain**: split the
 * scene in two and "40%" quietly starts meaning somewhere else. "The beginning of that scene" keeps
 * meaning what it said.
 *
 * It is also as fine as the data honestly goes. A scene is the smallest thing the story timeline
 * measures, so anything below it would be a precision the app cannot actually place.
 */
export const SCENE_POSITIONS = ['start', 'middle', 'end'] as const;

export type ScenePosition = (typeof SCENE_POSITIONS)[number];

/** Where a moment falls across the scene's own stretch, as a fraction of it. */
export const SCENE_POSITION_FRACTION: Record<ScenePosition, number> = {
  start: 0,
  middle: 0.5,
  end: 1,
};
