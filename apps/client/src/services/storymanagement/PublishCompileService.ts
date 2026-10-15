import {
  compileStoryReader,
  type CompileStoryReaderInput,
  type LocationIntExt,
  type ManuscriptFormat,
  type ManuscriptOptionsInput,
  type ReaderOptionsInput,
  sceneMatchesArc,
} from '@keres/shared';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '@/src/db';
import type { StorySelect } from '@/src/db/schema';
import { pdfFontMatrices } from '@/src/utils/pdfFontAssets';
import type {
  PublishManuscriptOptions,
  PublishReaderOptions,
} from '@/src/services/PublicationApiService';
import { createChapterService } from './ChapterService';
import { createChoiceService } from './ChoiceService';
import { createChoiceCheckGroupService } from './ChoiceCheckGroupService';
import { createChoiceCheckService } from './ChoiceCheckService';
import { createEffectService } from './EffectService';
import { createItemService } from './ItemService';
import { createLocationService } from './LocationService';
import { loadManuscriptMusic } from './ManuscriptMusicService';
import { loadManuscriptCover, loadManuscriptPages } from './ManuscriptPagesService';
import { createSceneService } from './SceneService';
import { createStoryArcService } from './StoryArcService';
import { describeChoiceAnnotations } from '@/src/utils/choiceAnnotations';

/** A locally compiled manuscript: the bytes plus how the server must file them. */
export interface CompiledPublishManuscript {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
  format: ManuscriptFormat;
}

/** A locally compiled reader: always one self-contained HTML page. */
export interface CompiledPublishReader {
  bytes: Uint8Array;
  mimeType: string;
}

export interface CompiledPublishArtifacts {
  manuscript?: CompiledPublishManuscript;
  reader?: CompiledPublishReader;
}

/** Formats that can show a picture; the rest keep a page's caption and text. */
const PICTURE_MANUSCRIPT_FORMATS: ReadonlySet<string> = new Set(['docx', 'pdf', 'epub', 'html']);

/**
 * One manuscript or reader compiles at a time: the memory a book costs is not
 * worth multiplying. The same reason the server serializes its own compiles.
 */
let compileTail: Promise<void> = Promise.resolve();

function withPublishCompileGate<T>(work: () => Promise<T>): Promise<T> {
  const previous = compileTail;
  let release!: () => void;
  compileTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  return (async () => {
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  })();
}

/**
 * Renders an already-assembled manuscript input to bytes. Thin on purpose: the
 * same shared compiler the server runs, with the same bundled serif matrices
 * the device export uses, so the same input compiles to the same bytes
 * wherever it runs.
 */
export async function renderPublishManuscript(
  input: CompileStoryReaderInput,
  options: ManuscriptOptionsInput,
  signal?: AbortSignal,
): Promise<CompiledPublishManuscript> {
  signal?.throwIfAborted();
  // Loaded when a publication compiles: the renderers bring `docx` and `jszip`, which the app start does not need.
  const { compileStoryManuscript } = await import('@keres/shared/manuscript/export');
  const compiled = await compileStoryManuscript(
    input,
    options,
    (await pdfFontMatrices().catch(() => null)) ?? undefined,
  );
  signal?.throwIfAborted();
  return {
    bytes: compiled.bytes,
    extension: compiled.extension,
    mimeType: compiled.mimeType,
    format: options.format as ManuscriptFormat,
  };
}

/** Renders an already-assembled reader input to its self-contained page. */
export function renderPublishReader(
  input: CompileStoryReaderInput,
  options: ReaderOptionsInput,
  signal?: AbortSignal,
): { bytes: Uint8Array; mimeType: string } {
  signal?.throwIfAborted();
  return compileStoryReader(input, options);
}

export interface PublishCompileRows {
  storyTitle: string;
  storyType: 'linear' | 'branching';
  chapters: {
    id: string;
    name: string;
    index: number;
    type: 'chapter' | 'event';
    arcId: string | null;
  }[];
  scenes: {
    id: string;
    chapterId: string | null;
    name: string;
    index: number;
    body: string | null;
    isDeleted: boolean;
    isStart: boolean;
    summary: string | null;
    locationId: string | null;
    pages?: CompileStoryReaderInput['scenes'][number]['pages'];
    music?: CompileStoryReaderInput['scenes'][number]['music'];
  }[];
  choices: { id: string; sceneId: string; nextSceneId: string; text: string }[];
  locations: { id: string; name: string; intExt: LocationIntExt | null }[];
  arcs: { id: string; title: string }[];
  groups: {
    id: string;
    choiceId: string;
    combinator: 'AND' | 'OR';
    order: number;
    isDeleted: boolean;
  }[];
  checks: {
    groupId: string;
    mode: 'block' | 'enable';
    type: 'sceneCount' | 'inventory' | 'trigger';
    order: number;
    sceneId: string | null;
    minVisits: number | null;
    itemId: string | null;
    itemPresence: 'has' | 'lacks' | null;
    triggerName: string | null;
    triggerState: 'set' | 'unset' | null;
    isDeleted: boolean;
  }[];
  effects: {
    entityType: string;
    entityId: string;
    effectType: string;
    itemId: string | null;
    triggerName: string | null;
    isDeleted: boolean;
  }[];
  items: { id: string; name: string }[];
}

/**
 * What the manuscript and the reader compile from: the local rows in the
 * shapes the pipeline reads, choice requirements and effects put into words by
 * the same describer the device export uses, and the raw rules the reader
 * plays by. Mirrors the server's `compileInputOf` over the synced export, so a
 * publication reads exactly like the local file.
 */
export function buildPublishCompileInput(
  rows: PublishCompileRows,
  t: TFunction,
): CompileStoryReaderInput {
  const annotations = describeChoiceAnnotations({
    groups: rows.groups,
    checks: rows.checks,
    effects: rows.effects,
    sceneNamesById: Object.fromEntries(rows.scenes.map((scene) => [scene.id, scene.name])),
    itemNamesById: Object.fromEntries(rows.items.map((item) => [item.id, item.name])),
    t,
  });
  const locationsById = new Map(rows.locations.map((row) => [row.id, row]));
  return {
    storyTitle: rows.storyTitle,
    storyType: rows.storyType,
    chapters: rows.chapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      index: chapter.index,
      type: chapter.type,
      arcId: chapter.arcId,
    })),
    scenes: rows.scenes.map((scene) => {
      const place = scene.locationId ? locationsById.get(scene.locationId) : undefined;
      return {
        id: scene.id,
        chapterId: scene.chapterId,
        name: scene.name,
        index: scene.index,
        body: scene.body,
        isDeleted: scene.isDeleted,
        isStart: scene.isStart,
        summary: scene.summary,
        locationName: place?.name ?? null,
        locationIntExt: place?.intExt ?? null,
        ...(scene.pages !== undefined ? { pages: scene.pages } : {}),
        ...(scene.music !== undefined ? { music: scene.music } : {}),
      };
    }),
    choices: rows.choices.map((choice) => ({
      id: choice.id,
      sceneId: choice.sceneId,
      nextSceneId: choice.nextSceneId,
      text: choice.text,
      ...annotations.get(choice.id),
    })),
    arcs: rows.arcs.map((arc) => ({ id: arc.id, title: arc.title })),
    rules: {
      groups: rows.groups.map((group) => ({
        id: group.id,
        choiceId: group.choiceId,
        combinator: group.combinator,
        isDeleted: group.isDeleted,
      })),
      checks: rows.checks.map((check) => ({ ...check })),
      effects: rows.effects.map((effect) => ({
        entityType: effect.entityType as 'Scene' | 'Choice',
        entityId: effect.entityId,
        effectType: effect.effectType as 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset',
        itemId: effect.itemId,
        triggerName: effect.triggerName,
        isDeleted: effect.isDeleted,
      })),
      items: rows.items.map((item) => ({ id: item.id, name: item.name })),
    },
  };
}

/**
 * Compiles the requested artifacts on this device and returns their bytes for
 * upload. Sketches are drawn straight from their content and covers and page
 * pictures are read from this device: nothing here writes to the Gallery, so
 * publishing no longer redraws snapshots first.
 */
export async function compilePublishArtifacts(
  db: AppDrizzleClient,
  story: StorySelect,
  userId: string,
  manuscriptOptions: PublishManuscriptOptions | undefined,
  readerOptions: PublishReaderOptions | undefined,
  t: TFunction,
  signal?: AbortSignal,
): Promise<CompiledPublishArtifacts> {
  return withPublishCompileGate(async () => {
    signal?.throwIfAborted();
    const [chapters, scenes, choices, locations, arcs, groups, checks, effects, items] =
      await Promise.all([
        createChapterService(db).getAllByStoryId(story.id, null),
        createSceneService(db).getAllByStoryId(story.id),
        createChoiceService(db).getAllByStoryId(story.id),
        createLocationService(db).getAllByStoryId(story.id),
        createStoryArcService(db).getArcsForStory(story.id),
        createChoiceCheckGroupService(db).getAllByStoryId(story.id),
        createChoiceCheckService(db).getAllByStoryId(story.id),
        createEffectService(db).getAllByStoryId(story.id),
        createItemService(db).getAllByStoryId(story.id),
      ]);
    signal?.throwIfAborted();

    const arcId = manuscriptOptions?.arcId ?? readerOptions?.arcId;
    const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const inScope = new Set(
      scenes
        .filter((scene) => !scene.isDeleted && sceneMatchesArc(scene, chaptersById, arcId))
        .map((scene) => scene.id),
    );

    // `includeSongs` rides inside the options at runtime (the server parses
    // it) but the client type hides it, like the rest of the song printing
    // choices the publish screen offers.
    const wantsSongs =
      (manuscriptOptions as { includeSongs?: boolean } | undefined)?.includeSongs === true;
    const sceneMusic =
      manuscriptOptions || readerOptions
        ? await loadManuscriptMusic(db, story.id, { withSongs: wantsSongs })
        : null;
    signal?.throwIfAborted();

    // Pages ride with in-scope scenes only, exactly like the server's export
    // does; formats without pictures keep a page's caption and text.
    const manuscriptCarriesPictures =
      manuscriptOptions !== undefined && PICTURE_MANUSCRIPT_FORMATS.has(manuscriptOptions.format);
    const readPictures = manuscriptCarriesPictures || readerOptions !== undefined;
    const loadedPages =
      (manuscriptOptions || readerOptions) && inScope.size > 0
        ? await loadManuscriptPages(db, userId, story.id, inScope, readPictures)
        : null;
    signal?.throwIfAborted();

    const withPages = scenes.map((scene) => {
      const pages = loadedPages?.pagesByScene.get(scene.id);
      const music = sceneMusic?.get(scene.id);
      return {
        ...scene,
        ...(pages ? { pages } : {}),
        ...(music ? { music } : {}),
      };
    });

    // The cover of the work being released, else the story's: read from this
    // device, and left out when it cannot be. Drawing and reading write no
    // files, so publishing writes nothing to the Gallery.
    const coverGalleryId = arcId
      ? (arcs.find((arc) => arc.id === arcId)?.coverGalleryId ?? story.coverGalleryId ?? null)
      : (story.coverGalleryId ?? null);
    const cover =
      (manuscriptCarriesPictures || readerOptions !== undefined) && coverGalleryId
        ? await loadManuscriptCover(db, coverGalleryId).catch(() => null)
        : null;
    signal?.throwIfAborted();

    // A cover the publisher switched off is no cover, not a hole.
    const includeCover =
      (manuscriptOptions as { includeCover?: boolean } | undefined)?.includeCover !== false &&
      (readerOptions as { includeCover?: boolean } | undefined)?.includeCover !== false;
    const media = {
      ...(loadedPages && readPictures ? loadedPages.media : {}),
      ...(cover && includeCover ? { [cover.key]: cover.image } : {}),
    };

    const input = buildPublishCompileInput(
      {
        storyTitle: story.title,
        storyType: story.type === 'branching' ? 'branching' : 'linear',
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          name: chapter.name,
          index: chapter.index,
          type: chapter.type,
          arcId: chapter.arcId,
        })),
        scenes: withPages.map((scene) => ({
          id: scene.id,
          chapterId: scene.chapterId,
          name: scene.name,
          index: scene.index,
          body: scene.body,
          isDeleted: scene.isDeleted,
          isStart: scene.isStart ?? false,
          summary: scene.summary,
          locationId: scene.locationId,
          ...(scene.pages ? { pages: scene.pages } : {}),
          ...(scene.music ? { music: scene.music } : {}),
        })),
        choices: choices.map((choice) => ({
          id: choice.id,
          sceneId: choice.sceneId,
          nextSceneId: choice.nextSceneId,
          text: choice.text,
        })),
        locations: locations.map((row) => ({ id: row.id, name: row.name, intExt: row.intExt })),
        arcs: arcs.map((arc) => ({ id: arc.id, title: arc.title })),
        groups: groups.map((group) => ({
          id: group.id,
          choiceId: group.choiceId,
          combinator: group.combinator,
          order: group.order,
          isDeleted: group.isDeleted,
        })),
        checks: checks.map((check) => ({ ...check })),
        effects: effects.map((effect) => ({
          entityType: effect.entityType,
          entityId: effect.entityId,
          effectType: effect.effectType,
          itemId: effect.itemId,
          triggerName: effect.triggerName,
          isDeleted: effect.isDeleted,
        })),
        items: items.map((item) => ({ id: item.id, name: item.name })),
      },
      t,
    );
    const withMedia: CompileStoryReaderInput = {
      ...input,
      ...(Object.keys(media).length > 0 ? { media } : {}),
      ...(cover && includeCover ? { cover: cover.key } : {}),
    };

    const result: CompiledPublishArtifacts = {};
    if (manuscriptOptions) {
      result.manuscript = await renderPublishManuscript(
        withMedia,
        manuscriptOptions as ManuscriptOptionsInput,
        signal,
      );
    }
    if (readerOptions) {
      const rendered = renderPublishReader(withMedia, readerOptions as ReaderOptionsInput, signal);
      result.reader = { bytes: rendered.bytes, mimeType: rendered.mimeType };
    }
    return result;
  });
}
