/**
 * The narrative of each bundled example story, written by hand, one entry per language.
 *
 * It exists because the alternative was worse. `build-example-story.ts` used to invent whatever the
 * tests counted: if a tale had seven scenes and the suite asked for twelve, it appended five named
 * "A new consequence", "The difficult decision" and so on, each summarised with the same sentence
 * about "this stage of <title>", and moved the story's ending flag onto the last of them. Cinderella
 * finished on "The price of change". Locations, items and world rules were padded the same way, and
 * character relations were paired by modular arithmetic that wrapped around and repeated itself.
 *
 * Everything a reader sees is authored here. The generator's job is the scaffolding that genuinely
 * has no narrative content - the stat ladders, the schema fields, the tag palette - and it refuses to
 * write anything it was not given.
 *
 * Indexes, not ids: entities are matched positionally against the story's existing rows, so these
 * files stay readable and the deterministic ids stay stable across regenerations. One file per story,
 * beside this one.
 */

export interface NarrativeScene {
  name: string;
  summary: string;
  /** Index into `locations`. */
  location: number;
}

export interface NarrativeRelation {
  /** Indexes into `characters`. */
  pair: [number, number];
  type: string;
}

export interface NarrativeItemJourney {
  /** Index into `scenes`. */
  scene: number;
  state: string;
  /** Index into `characters`, or null when the item is left behind rather than handed over. */
  owner: number | null;
}

export interface NarrativeItem {
  name: string;
  description: string;
  category: string;
  initialState: string;
  /** Index into `characters`, or null for an item nobody owns yet. */
  owner: number | null;
  journey: NarrativeItemJourney[];
}

export interface StoryNarrative {
  chapters: { name: string; summary: string }[];
  /** Twelve, in reading order: four per chapter. */
  scenes: NarrativeScene[];
  /** The scene that opens the story, and the ones that can end it. */
  startScene: number;
  finishScenes: number[];
  /**
   * Five, ordered so that the relations between them read correctly: 0 contains 1, 1 contains 2,
   * 2 is connected to 3, 3 is connected to 4.
   */
  locations: { name: string; description: string }[];
  characters: { name: string; description: string }[];
  /** Which scenes each character appears in, by index. */
  presence: number[][];
  relations: NarrativeRelation[];
  items: NarrativeItem[];
  worldRules: { title: string; description: string }[];
  notes: { title: string; body: string }[];
  /** Craft tags used to mark up the story, in the palette order the generator colours them. */
  tags: string[];
  /** Prefix for a branching story's choice text, completed with the destination scene's name. */
  choiceLabel: string;
  /**
   * The two triggers the branching stories' checks read, and the scenes that set and clear them.
   * Linear stories still declare them: the export format carries effects either way.
   */
  triggers: { set: string; unset: string };
  /** `[effectType, itemIndex | null, scene]` for the four effects every example demonstrates. */
  effects: {
    type: 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';
    item: number | null;
    scene: number;
  }[];
}

export type LocalizedNarrative = Record<'en' | 'pt', StoryNarrative>;
