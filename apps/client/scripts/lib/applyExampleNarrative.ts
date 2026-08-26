import { createHash } from 'node:crypto';
import type { StoryNarrative } from './exampleStoryNarrative';

/**
 * Writes an authored narrative over a bundled example story, in place.
 *
 * Ids are never regenerated: every row keeps the one it already had, so the relations that point at
 * scenes, characters, locations and items - `tagRelations`, `noteRelations`, `comments`, `favorites`,
 * `seeAlsoRelations`, `attributeValues`, `plotScenes`, `choices` - stay valid without being rewritten.
 * What changes is everything a reader sees, plus the four collections the narrative genuinely owns:
 * which scene sits in which chapter and location, who appears where, who is related to whom, and
 * where each item travels.
 *
 * Collections are matched positionally against the narrative, so the counts have to agree. They are
 * checked rather than padded - the padding is what produced stories that ended on a scene called
 * "The price of change".
 */

type Row = Record<string, any>;
type StoryDocument = Record<string, any>;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Same derivation as `build-example-story.ts`: new rows must not get random ids. */
function deterministicUlid(slug: string, key: string): string {
  const bytes = createHash('sha256').update(`${slug}:${key}`).digest().subarray(0, 16);
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  for (let index = 0; index < 26; index += 1) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function applyNarrative(
  slug: string,
  story: StoryDocument,
  narrative: StoryNarrative,
): StoryDocument {
  const storyId = story.story.id as string;
  const fixedDate = story.story.updatedAt as string;
  const id = (key: string) => deterministicUlid(slug, key);
  const base = (rowId: string) => ({
    id: rowId,
    storyId,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });

  expect(narrative.scenes.length === 12, `${slug}: expected 12 authored scenes`);
  expect(narrative.chapters.length === 3, `${slug}: expected 3 authored chapters`);
  expect(narrative.locations.length === 5, `${slug}: expected 5 authored locations`);
  expect(
    narrative.characters.length === story.characters.length,
    `${slug}: authored ${narrative.characters.length} characters, the story has ${story.characters.length}`,
  );
  expect(
    narrative.presence.length === narrative.characters.length,
    `${slug}: every character needs a presence list`,
  );
  expect(narrative.items.length === 3, `${slug}: expected 3 authored items`);
  expect(narrative.worldRules.length === 3, `${slug}: expected 3 authored world rules`);
  expect(narrative.notes.length === 3, `${slug}: expected 3 authored notes`);
  expect(narrative.tags.length === 4, `${slug}: expected 4 authored tags`);

  // A branching story's checks are written against item 0 and item 1 by position: one group requires
  // the first in inventory, another is blocked by the second. Granting anything else leaves a choice
  // that can never be taken, and blocking on something the story does grant leaves one that can never
  // be avoided - both of which the story analysis reports as an error rather than a hint.
  //
  // Where the grant sits matters too. The analysis approximates "before" with the breadth-first level
  // of each scene, so a shortcut edge can put a late scene on a low level and leave a grant placed
  // just before it looking like it happens afterwards. Granting on the opening scene is always safe.
  if ((story.choiceCheckGroups ?? []).length) {
    const granted = narrative.effects.find((effect) => effect.type === 'itemGrant');
    const taken = narrative.effects.find((effect) => effect.type === 'itemTake');
    expect(
      granted?.item === 0 && taken?.item === 1,
      `${slug}: a branching story must grant item 0 and take item 1 - its choice checks read those two positions`,
    );
    expect(
      !narrative.effects.some((effect) => effect.type === 'itemGrant' && effect.item === 1),
      `${slug}: item 1 is what a check blocks on; granting it makes that choice unreachable`,
    );
  }

  // --- Chapters, locations, characters: text only, ids untouched ---
  const chapters = story.chapters.map((chapter: Row, index: number) => ({
    ...chapter,
    name: narrative.chapters[index].name,
    summary: narrative.chapters[index].summary,
    index: index + 1,
  }));

  const locations = story.locations.map((location: Row, index: number) => ({
    ...location,
    name: narrative.locations[index].name,
    description: narrative.locations[index].description,
  }));

  const characters = story.characters.map((character: Row, index: number) => ({
    ...character,
    name: narrative.characters[index].name,
    description: narrative.characters[index].description,
    isFavorite: index === 0,
  }));

  // --- Scenes: text, and the two links the narrative decides ---
  const scenes = story.scenes.map((scene: Row, index: number) => {
    const authored = narrative.scenes[index];
    return {
      ...scene,
      chapterId: chapters[Math.floor(index / 4)].id,
      locationId: locations[authored.location].id,
      name: authored.name,
      index: (index % 4) + 1,
      summary: authored.summary,
      isStart: index === narrative.startScene,
      isFinish: narrative.finishScenes.includes(index),
      isFavorite: index === narrative.startScene,
    };
  });

  // --- Character presence: rebuilt from the authored lists ---
  const characterScenes = narrative.presence.flatMap((sceneIndexes, characterIndex) =>
    sceneIndexes.map((sceneIndex) => {
      expect(
        sceneIndex >= 0 && sceneIndex < scenes.length,
        `${slug}: character ${characterIndex} appears in a scene that does not exist`,
      );
      return {
        ...base(id(`character-scene-${characterIndex}-${sceneIndex}`)),
        characterId: characters[characterIndex].id,
        sceneId: scenes[sceneIndex].id,
      };
    }),
  );

  // --- Relations: one row per authored pair, no arithmetic involved ---
  const seenPairs = new Set<string>();
  const characterRelations = narrative.relations.map(({ pair: [first, second], type }, index) => {
    expect(first !== second, `${slug}: relation ${index} links a character to itself`);
    const key = first < second ? `${first}-${second}` : `${second}-${first}`;
    expect(!seenPairs.has(key), `${slug}: relation ${index} repeats the pair ${key}`);
    seenPairs.add(key);
    return {
      ...base(id(`character-relation-${index}`)),
      character1Id: characters[first].id,
      character2Id: characters[second].id,
      relationType: type,
    };
  });

  // --- Items and their journeys ---
  const items = story.items.map((item: Row, index: number) => {
    const authored = narrative.items[index];
    return {
      ...item,
      characterOwnerId: authored.owner === null ? null : characters[authored.owner].id,
      name: authored.name,
      category: authored.category,
      description: authored.description,
      initialState: authored.initialState,
    };
  });

  const itemJourneys = narrative.items.flatMap((item, itemIndex) =>
    item.journey.map((stop, journeyIndex) => ({
      ...base(id(`item-journey-${itemIndex}-${journeyIndex}`)),
      itemId: items[itemIndex].id,
      sceneId: scenes[stop.scene].id,
      newCharacterOwnerId: stop.owner === null ? null : characters[stop.owner].id,
      newState: stop.state,
      extraNotes: null,
    })),
  );

  const worldRules = story.worldRules.map((rule: Row, index: number) => ({
    ...rule,
    title: narrative.worldRules[index].title,
    description: narrative.worldRules[index].description,
  }));

  const notes = story.notes.map((note: Row, index: number) => ({
    ...note,
    title: narrative.notes[index].title,
    body: narrative.notes[index].body,
  }));

  const tags = story.tags.map((tag: Row, index: number) => ({
    ...tag,
    name: narrative.tags[index],
  }));

  // --- Effects: the four types every example demonstrates, on the authored scenes ---
  const triggerFor = (type: string) =>
    type === 'triggerSet' ? narrative.triggers.set : narrative.triggers.unset;
  const effects = narrative.effects.map((effect, index) => ({
    ...base(id(`effect-${index}`)),
    entityType: 'Scene',
    entityId: scenes[effect.scene].id,
    effectType: effect.type,
    itemId: effect.item === null ? null : items[effect.item].id,
    triggerName: effect.item === null ? triggerFor(effect.type) : null,
  }));

  // The branching checks read the same two triggers by name; renaming them per story without
  // renaming them here would leave a check waiting on a trigger nothing ever sets.
  const choiceChecks = (story.choiceChecks ?? []).map((check: Row) => ({
    ...check,
    triggerName:
      check.triggerName === null
        ? null
        : check.triggerState === 'set' && check.mode === 'block'
          ? narrative.triggers.unset
          : narrative.triggers.set,
  }));

  // Choice texts name their destination scene, which has just been renamed.
  const sceneNameById = new Map(scenes.map((scene: Row) => [scene.id, scene.name]));
  const choices = (story.choices ?? []).map((choice: Row) => ({
    ...choice,
    text: `${narrative.choiceLabel} ${sceneNameById.get(choice.nextSceneId)}`,
  }));

  // Comment snapshots quote the field they were left on; a stale quotation is a lie about the text.
  const snapshotOf = (entityType: string, entityId: string): string | null => {
    const source =
      entityType === 'Character'
        ? characters.find((row: Row) => row.id === entityId)
        : entityType === 'Scene'
          ? scenes.find((row: Row) => row.id === entityId)
          : entityType === 'Item'
            ? items.find((row: Row) => row.id === entityId)
            : locations.find((row: Row) => row.id === entityId);
    if (!source) return null;
    return (source.description ?? source.summary ?? null) as string | null;
  };
  const comments = (story.comments ?? []).map((comment: Row) => ({
    ...comment,
    contentSnapshot: snapshotOf(comment.entityType, comment.entityId) ?? comment.contentSnapshot,
  }));

  // The autocomplete catalog quotes the items' own category and state; leaving the old values in
  // would suggest words that appear nowhere in the story.
  const suggestions = (story.suggestions ?? []).map((suggestion: Row) =>
    suggestion.type === 'item_category'
      ? { ...suggestion, value: items[0].category }
      : suggestion.type === 'item_state'
        ? { ...suggestion, value: items[0].initialState }
        : suggestion,
  );

  return {
    ...story,
    chapters,
    scenes,
    choices,
    choiceChecks,
    effects,
    characters,
    characterRelations,
    characterScenes,
    locations,
    worldRules,
    notes,
    tags,
    items,
    itemJourneys,
    suggestions,
    comments,
  };
}
