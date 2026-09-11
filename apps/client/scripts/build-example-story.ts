import {
  CURRENT_STORY_FORMAT_VERSION,
  describeStoryIntegrityViolations,
  findStoryExportIntegrityErrors,
} from '@keres/shared';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyNarrative } from './lib/applyExampleNarrative';
import { buildExampleStoryMetadata } from './lib/buildExampleStoryMetadata';
import { buildExampleStoryShowcase } from './lib/buildExampleStoryShowcase';
import { exampleStoryLocalizedText } from './lib/exampleStoryLocalizedText';
import {
  base,
  deterministicUlid,
  FIXED_DATE,
  publicSourceUrl,
  showcaseText,
  type ExampleStoryLanguage,
} from './lib/exampleStoryBuilderSupport';
import { exampleStoryNarratives } from './lib/exampleStoryNarrative';

type Language = ExampleStoryLanguage;
type StoryDocument = Record<string, any>;

const CONTENT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/exampleStories/content',
);
const EXAMPLE_USER_ID = 'EXAMPLEUSERPLACEHOLDER0000';

/**
 * Nothing here invents narrative any more.
 *
 * This used to be `ensureCount`, which appended rows until a collection was as long as the tests
 * counted: scenes named "A new consequence", locations called "The Crossroads", an item called
 * "A Keepsake", each described with the same sentence about "this stage of <title>". A story with
 * seven scenes was published with twelve, and its ending flag moved onto the padding. It is a
 * refusal now: a story that has not been written is not something a script can finish.
 */
function requireCount(source: any[] | undefined, count: number, what: string, slug: string): any[] {
  const rows = source ?? [];
  if (rows.length < count) {
    throw new Error(
      `${slug}: has ${rows.length} ${what}, needs at least ${count}. Write them in scripts/lib/narratives/ - this script does not invent them.`,
    );
  }
  return rows;
}

function buildStory(slug: string, language: Language, source: StoryDocument): StoryDocument {
  const text = exampleStoryLocalizedText[language];
  const showcase = showcaseText(language);
  const storyId = source.story.id as string;
  const id = (key: string) => deterministicUlid(slug, key);

  const characters = requireCount(source.characters, 6, 'characters', slug).map(
    (character, index) => ({
      ...character,
      storyId,
      description: character.description,
      isFavorite: index === 0,
    }),
  );

  const locations = requireCount(source.locations, 5, 'locations', slug).map((location) => ({
    ...location,
    storyId,
    description: location.description,
  }));

  // The current story format always owns one default Arc internally. Examples deliberately do
  // not add authored arcs beyond that mandatory container: their narratives are too short to need
  // campaign-level grouping.
  const storyArcs = [
    {
      ...base(id('arc-default'), storyId),
      title: 'Arc',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    },
  ];

  const chapters = Array.from({ length: 3 }, (_, index) => {
    const old = source.chapters?.[index];
    return {
      ...base(old?.id ?? id(`chapter-${index}`), storyId),
      ...old,
      storyId,
      name: old?.name,
      index: index + 1,
      arcId: storyArcs[0].id,
      summary: old?.summary ?? null,
      isFavorite: false,
      extraNotes: old?.extraNotes ?? null,
    };
  });

  const scenes = requireCount(source.scenes, 12, 'scenes', slug).map((scene, index) => {
    const chapterIndex = Math.floor(index / 4);
    const durationUnits = ['minutes', 'hours', 'days', 'minutes', 'years'] as const;
    const gapUnits = ['minutes', 'hours', 'days', 'minutes'] as const;
    return {
      ...base(scene.id, storyId),
      ...scene,
      storyId,
      chapterId: chapters[chapterIndex].id,
      locationId: locations[index % locations.length].id,
      name: scene.name,
      index: (index % 4) + 1,
      summary: scene.summary,
      gap: index === 0 ? 0 : index % 7 === 0 ? -2 : [15, 2, 1, 30][index % 4],
      gapType: gapUnits[index % gapUnits.length],
      calendarDateOverride: null,
      calendarDateOverrideCalendarId: null,
      duration: [10, 2, 1, 45, 1][index % 5],
      durationType: durationUnits[index % durationUnits.length],
      isStart: index === 0,
      isFinish: source.story.type === 'branching' ? index >= 10 : index === 11,
      isFavorite: index === 0,
      extraNotes: scene.extraNotes ?? null,
    };
  });

  const items = requireCount(source.items, 3, 'items', slug).map((item) => ({
    ...item,
    storyId,
    description: item.description,
    initialState: item.initialState,
  }));

  const worldRules = requireCount(source.worldRules, 3, 'worldRules', slug).map((rule) => ({
    ...rule,
    storyId,
    description: rule.description,
  }));

  const notes = Array.from({ length: 3 }, (_, index) => ({
    ...base(id(`note-${index}`), storyId),
    title: source.notes?.[index]?.title ?? '',
    body: source.notes?.[index]?.body ?? '',
    isFavorite: false,
    extraNotes: null,
  }));
  const tags = Array.from({ length: 4 }, (_, index) => ({
    ...base(id(`tag-${index}`), storyId),
    name: source.tags?.[index]?.name ?? '',
    color: ['#7C3AED', '#0EA5E9', '#F59E0B', '#10B981'][index],
    isFavorite: false,
    extraNotes: null,
  }));

  const characterScenes: any[] = [];
  const presencePatterns = [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 2, 4, 6, 8, 10],
    [1, 2, 5, 8, 9],
    [3, 6, 9, 11],
    [7],
    [10, 11],
  ];
  characters.forEach((character, characterIndex) => {
    const pattern = presencePatterns[characterIndex] ?? [characterIndex % scenes.length];
    pattern.forEach((sceneIndex) =>
      characterScenes.push({
        ...base(id(`character-scene-${characterIndex}-${sceneIndex}`), storyId),
        characterId: character.id,
        sceneId: scenes[sceneIndex].id,
      }),
    );
  });

  // Distinct unordered pairs, taken in order from the combinations of the cast. The previous version
  // walked the cast with two modular offsets, which wrapped around and produced the same pair twice
  // once it ran past the end - the duplicated relations every bundled example shipped with. One
  // relation exists per pair of characters, whichever column each id sits in.
  const relationPairs: [number, number][] = [];
  const relationTarget = Math.max(6, characters.length + 2);
  for (
    let first = 0;
    first < characters.length && relationPairs.length < relationTarget;
    first += 1
  )
    for (
      let second = first + 1;
      second < characters.length && relationPairs.length < relationTarget;
      second += 1
    )
      relationPairs.push([first, second]);
  const characterRelations = relationPairs.map(([first, second], index) => ({
    ...base(id(`character-relation-${index}`), storyId),
    character1Id: characters[first].id,
    character2Id: characters[second].id,
    relationType: '',
  }));

  const locationRelations = [
    [0, 1, 'contains'],
    [1, 2, 'contains'],
    [2, 3, 'connected_to'],
    [3, 4, 'connected_to'],
  ].map(([a, b, relationType], index) => ({
    ...base(id(`location-relation-${index}`), storyId),
    locationAId: locations[Number(a)].id,
    locationBId: locations[Number(b)].id,
    relationType,
  }));

  const itemJourneys = items.slice(0, 3).flatMap((item, itemIndex) =>
    [itemIndex, itemIndex + 4, itemIndex + 8].map((sceneIndex, journeyIndex) => ({
      ...base(id(`item-journey-${itemIndex}-${journeyIndex}`), storyId),
      itemId: item.id,
      sceneId: scenes[sceneIndex].id,
      newCharacterOwnerId:
        journeyIndex === 2
          ? null
          : characters[(itemIndex + journeyIndex + 1) % characters.length].id,
      newState: '',
      extraNotes: null,
    })),
  );

  const noteTargets = [
    ['Character', characters[0].id],
    ['Scene', scenes[3].id],
    ['WorldRule', worldRules[0].id],
    ['Location', locations[2].id],
  ];
  const noteRelations = noteTargets.map(([relationType, relationId], index) => ({
    ...base(id(`note-relation-${index}`), storyId),
    noteId: notes[index % notes.length].id,
    relationId,
    relationType,
  }));

  const tagTargets = [
    ['Character', characters[0].id],
    ['Scene', scenes[0].id],
    ['Location', locations[0].id],
    ['Item', items[0].id],
    ['Scene', scenes[3].id],
    ['Character', characters[2].id],
    ['Location', locations[3].id],
    ['Item', items[2].id],
    ['Scene', scenes[8].id],
    ['Chapter', chapters[2].id],
  ];
  const tagRelations = tagTargets.map(([relationType, relationId], index) => ({
    ...base(id(`tag-relation-${index}`), storyId),
    tagId: tags[index % tags.length].id,
    relationId,
    relationType,
  }));

  const {
    storySchemaFields,
    attributeValues,
    suggestions,
    stats,
    defaultLadder,
    customLadder,
    modes,
    statRelations,
  } = buildExampleStoryMetadata({
    slug,
    language,
    source,
    text,
    showcase,
    storyId,
    id,
    base,
    characters,
    locations,
  });
  let choices: any[] = [];
  let routes: any[] = [];
  let routeSteps: any[] = [];
  let choiceCheckGroups: any[] = [];
  let choiceChecks: any[] = [];
  let plots: any[] = [];
  let plotScenes: any[] = [];
  if (source.story.type === 'branching') {
    const edges = [
      ...Array.from({ length: 10 }, (_, index) => [index, index + 1]),
      [9, 11],
      [0, 3],
      [3, 6],
      [6, 3],
      [8, 11],
      [7, 10],
    ];
    choices = edges.map(([from, to], index) => ({
      ...base(id(`choice-${index}`), storyId),
      sceneId: scenes[from].id,
      nextSceneId: scenes[to].id,
      text: '',
    }));
    const routeDefinitions = [
      {
        name: language === 'pt' ? 'Caminho principal' : 'Main route',
        sceneIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11],
      },
      {
        name: language === 'pt' ? 'Atalho revelado' : 'Revealed shortcut',
        sceneIndexes: [0, 3, 6, 7, 10],
      },
    ];
    routes = routeDefinitions.map((route, index) => ({
      ...base(id(`route-${index}`), storyId),
      name: route.name,
      details:
        language === 'pt'
          ? 'Um percurso possível pelas escolhas da história.'
          : 'One possible traversal through the story choices.',
    }));
    routeSteps = routeDefinitions.flatMap((route, routeIndex) =>
      route.sceneIndexes.map((sceneIndex, position) => {
        const nextSceneIndex = route.sceneIndexes[position + 1];
        const selectedChoice = choices.find(
          (choice) =>
            choice.sceneId === scenes[sceneIndex].id &&
            choice.nextSceneId === scenes[nextSceneIndex]?.id,
        );
        return {
          ...base(id(`route-step-${routeIndex}-${position}`), storyId),
          routeId: routes[routeIndex].id,
          position: position + 1,
          sceneId: scenes[sceneIndex].id,
          selectedChoiceId: selectedChoice?.id ?? null,
        };
      }),
    );
    choiceCheckGroups = [0, 1, 2, 3].map((index) => ({
      ...base(id(`choice-check-group-${index}`), storyId),
      choiceId: choices[12 + index].id,
      combinator: index % 2 === 0 ? 'AND' : 'OR',
      order: index,
    }));
    const checkData = [
      {
        group: 0,
        mode: 'enable',
        type: 'sceneCount',
        sceneId: scenes[0].id,
        minVisits: 1,
      },
      {
        group: 0,
        mode: 'enable',
        type: 'inventory',
        itemId: items[0].id,
        itemPresence: 'has',
      },
      {
        group: 1,
        mode: 'block',
        type: 'trigger',
        triggerName: 'secret_closed',
        triggerState: 'set',
      },
      {
        group: 1,
        mode: 'enable',
        type: 'sceneCount',
        sceneId: scenes[3].id,
        minVisits: 1,
      },
      {
        group: 2,
        mode: 'block',
        type: 'inventory',
        itemId: items[1].id,
        itemPresence: 'has',
      },
      {
        group: 3,
        mode: 'enable',
        type: 'trigger',
        triggerName: 'path_revealed',
        triggerState: 'set',
      },
    ];
    choiceChecks = checkData.map((check, index) => ({
      ...base(id(`choice-check-${index}`), storyId),
      groupId: choiceCheckGroups[check.group].id,
      mode: check.mode,
      type: check.type,
      order: index,
      sceneId: check.sceneId ?? null,
      minVisits: check.minVisits ?? null,
      itemId: check.itemId ?? null,
      itemPresence: check.itemPresence ?? null,
      triggerName: check.triggerName ?? null,
      triggerState: check.triggerState ?? null,
    }));
  } else {
    plots = text.plotNames.map((name, index) => ({
      ...base(id(`plot-${index}`), storyId),
      name,
      details: text.plotDetails[index],
    }));
    const coverage = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 3, 5], [8, 9, 10, 11], []];
    plotScenes = coverage.flatMap((sceneIndexes, plotIndex) =>
      sceneIndexes.map((sceneIndex, relationIndex) => ({
        ...base(id(`plot-scene-${plotIndex}-${sceneIndex}`), storyId),
        plotId: plots[plotIndex].id,
        sceneId: scenes[sceneIndex].id,
        note: text.plotNotes[Math.min(relationIndex, text.plotNotes.length - 1)],
      })),
    );
  }

  const effects = [
    ['itemGrant', items[0].id, null],
    ['itemTake', items[1].id, null],
    ['triggerSet', null, 'path_revealed'],
    ['triggerUnset', null, 'secret_closed'],
  ].map(([effectType, itemId, triggerName], index) => ({
    ...base(id(`effect-${index}`), storyId),
    entityType: 'Scene',
    entityId: scenes[index * 2].id,
    effectType,
    itemId,
    triggerName,
  }));

  const comments = [
    ['Character', characters[0].id, 'description', characters[0].description],
    ['Scene', scenes[4].id, 'summary', scenes[4].summary],
    ['Item', items[1].id, 'description', items[1].description],
    ['Location', locations[2].id, 'description', locations[2].description],
  ].map(([entityType, entityId, fieldKey, contentSnapshot], index) => ({
    ...base(id(`comment-${index}`), storyId),
    entityType,
    entityId,
    fieldId: null,
    fieldKey,
    contentSnapshot,
    excerptText: null,
    authorUserId: EXAMPLE_USER_ID,
    commentText: text.comments[index],
    criticality: [1, 3, 5, 3][index],
  }));
  const seeAlsoRelations = [
    ['Character', characters[0].id, 'Location', locations[0].id],
    ['Scene', scenes[2].id, 'Item', items[0].id],
    ['Chapter', chapters[1].id, 'WorldRule', worldRules[0].id],
    ['ItemJourney', itemJourneys[0].id, 'Character', characters[1].id],
  ].map(([entityAType, entityAId, entityBType, entityBId], index) => ({
    ...base(id(`see-also-${index}`), storyId),
    entityAType,
    entityAId,
    entityBType,
    entityBId,
  }));
  const favorites = [
    ['Story', storyId],
    ['Character', characters[0].id],
    ['Scene', scenes[0].id],
  ].map(([entityType, entityId], index) => ({
    ...base(id(`favorite-${index}`), storyId),
    entityId,
    entityType,
    userId: EXAMPLE_USER_ID,
  }));

  const {
    storyCalendars,
    chapterAnchors,
    storyBoards,
    storyLocationMaps,
    gallery,
    galleryRelations,
  } = buildExampleStoryShowcase({
    slug,
    language,
    showcase,
    storyId,
    id,
    base,
    publicSourceUrl,
    chapters,
    scenes,
    characters,
    locations,
    items,
  });
  return {
    ...source,
    // The constant, not a literal: pinned by hand it silently falls behind the format, and the
    // guard in `ExampleStoryService.test.ts` only catches that after the packages are stale.
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    serverLastOperationVersion: 0,
    story: {
      ...source.story,
      userId: EXAMPLE_USER_ID,
      favoriteBehavior: 'individual',
      theme: null,
      timelineEpochDay: slug === 'cinderella' ? 18 : slug === 'goldilocks' ? 20_000 : null,
      timelineEpochSeconds: slug === 'cinderella' ? 72_000 : slug === 'goldilocks' ? 25_200 : null,
      normalizeSceneTiming: false,
      allowReaderComments: true,
      autoLinkMentions: true,
      vocabulary: null,
      completenessChecks: true,
      statSystem: true,
      statNotation: 'letter',
      updatedAt: FIXED_DATE,
    },
    chapters,
    scenes,
    choices,
    choiceCheckGroups,
    choiceChecks,
    effects,
    characters,
    characterRelations,
    characterScenes,
    locations,
    locationRelations,
    worldRules,
    notes,
    noteRelations,
    tags,
    tagRelations,
    suggestions,
    items,
    itemJourneys,
    plots,
    plotScenes,
    routes,
    routeSteps,
    storySchemaFields,
    attributeValues,
    comments,
    seeAlsoRelations,
    favorites,
    chapterAnchors,
    storyCalendars,
    storyArcs,
    storyBoards,
    storyLocationMaps,
    stats,
    statStrengths: [...defaultLadder, ...customLadder],
    statRelations,
    modes,
    galleryItems: [gallery],
    galleryRelations,
  };
}

for (const slug of readdirSync(CONTENT_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  for (const language of ['en', 'pt'] as const) {
    const file = join(CONTENT_ROOT, slug, `${language}.json`);
    const source = JSON.parse(readFileSync(file, 'utf8')) as StoryDocument;
    const narrative = exampleStoryNarratives[slug]?.[language];
    if (!narrative) {
      throw new Error(
        `${slug}/${language}: no authored narrative in scripts/lib/narratives/. Write one before building this story.`,
      );
    }
    // The scaffolding first, then everything a reader sees. Splitting it this way is the point: this
    // script lays out rows and links and knows nothing about any of these stories, and `applyNarrative`
    // writes the authored text over them without touching a single id.
    const built = applyNarrative(slug, buildStory(slug, language, source), narrative);
    // This script writes over its own input, so anything it gets wrong is written to disk and
    // becomes the source of the next run. It generates relations and references by arithmetic on
    // indexes, which is exactly the kind of code that quietly wraps around and repeats itself: it
    // shipped duplicated character relations that no test, no importer and no screen refused.
    // Nothing leaves here that the importers would refuse.
    const violations = findStoryExportIntegrityErrors(
      built as StoryDocument & { story: { id: string } },
    );
    if (violations.length) {
      throw new Error(
        `${slug}/${language} would be written corrupt: ${describeStoryIntegrityViolations(violations)}`,
      );
    }
    writeFileSync(file, `${JSON.stringify(built, null, 2)}\n`, 'utf8');
  }
}

console.log('Built complete bilingual example stories.');
