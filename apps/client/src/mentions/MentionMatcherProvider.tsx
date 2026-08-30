import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { and, eq } from 'drizzle-orm';
import { DrizzleContext } from '../db';
import * as schema from '../db/schema';
import { useStoryStore } from '../state/storyStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from '../hooks/useEntityRefreshLifecycle';
import {
  buildMentionMatcher,
  EMPTY_MENTION_MATCHER,
  type MentionableEntity,
  type MentionMatcher,
} from '../utils/entityMentions';
import { loadEntityOptions } from '../utils/entityOptions';
import { buildMentionBacklinkIndex, type MentionTextSource } from './mentionBacklinks';
import { MentionBacklinksContext, MentionMatcherContext } from './MentionContext';

/**
 * The entity types a writer refers to by name in prose.
 *
 * Deliberately not every `NavigableEntityType`. `Choice` has no name (its identifying field is the
 * whole choice text) and `ItemJourney` has none either; `Mode` has no screen of its own; and `Tag`
 * is a label rather than something prose names - tag names are short common words ("war",
 * "flashback"), which is exactly the collision the matcher's rules cannot defend against.
 */
export const MENTIONABLE_ENTITY_TYPES = [
  'Character',
  'Location',
  'Item',
  'Scene',
  'Chapter',
  'Note',
  'WorldRule',
  'Plot',
] as const;

/** One change event per mentionable type - any of them can add, rename or remove a linkable name. */
const CHANGE_EVENTS = [
  'character_changed',
  'location_changed',
  'item_changed',
  'scene_changed',
  'chapter_changed',
  'note_changed',
  'worldrule_changed',
  'plot_changed',
] as const;

/**
 * Builds the current story's mention matcher, once, for the whole drawer.
 *
 * Rebuilding per render is the performance failure mode for this feature - every text field on
 * every detail screen consumes the matcher - so it is rebuilt only when the story changes or one of
 * its named entities does. With auto-linking off, nothing is queried at all.
 */
export const MentionMatcherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The context directly rather than `useDrizzle()`: this provider wraps the whole drawer, and a
  // reading convenience must not be what stops the navigator from mounting when the database is not
  // there yet (or, in a test, at all). Without it, the matcher simply stays empty.
  const drizzleDb = useContext(DrizzleContext);
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const [matcher, setMatcher] = useState<MentionMatcher>(EMPTY_MENTION_MATCHER);
  const [backlinks, setBacklinks] = useState(() => new Map());

  const storyId = selectedStory?.id;
  const enabled =
    Boolean(storyId) && Boolean(drizzleDb) && selectedStory?.autoLinkMentions === true;

  /** Guards against an earlier load resolving after a later one and overwriting it. */
  const loadToken = useRef(0);

  const reload = useCallback(async () => {
    const token = ++loadToken.current;
    if (!enabled || !storyId || !drizzleDb) {
      setMatcher(EMPTY_MENTION_MATCHER);
      setBacklinks(new Map());
      return;
    }
    try {
      const perType = await Promise.all(
        MENTIONABLE_ENTITY_TYPES.map(async (type) =>
          (await loadEntityOptions(drizzleDb, storyId, type)).map<MentionableEntity>((option) => ({
            type,
            id: option.id,
            name: option.name,
          })),
        ),
      );
      const named = perType.flat();
      const nextMatcher = buildMentionMatcher(named);
      const names = new Map(named.map((entity) => [`${entity.type}:${entity.id}`, entity.name]));
      const [characters, locations, items, scenes, chapters, notes, worldRules, plots] = await Promise.all([
        drizzleDb.select().from(schema.characters).where(and(eq(schema.characters.storyId, storyId), eq(schema.characters.isDeleted, false))).all(),
        drizzleDb.select().from(schema.locations).where(and(eq(schema.locations.storyId, storyId), eq(schema.locations.isDeleted, false))).all(),
        drizzleDb.select().from(schema.items).where(and(eq(schema.items.storyId, storyId), eq(schema.items.isDeleted, false))).all(),
        drizzleDb.select().from(schema.scenes).where(and(eq(schema.scenes.storyId, storyId), eq(schema.scenes.isDeleted, false))).all(),
        drizzleDb.select().from(schema.chapters).where(and(eq(schema.chapters.storyId, storyId), eq(schema.chapters.isDeleted, false))).all(),
        drizzleDb.select().from(schema.notes).where(and(eq(schema.notes.storyId, storyId), eq(schema.notes.isDeleted, false))).all(),
        drizzleDb.select().from(schema.worldRules).where(and(eq(schema.worldRules.storyId, storyId), eq(schema.worldRules.isDeleted, false))).all(),
        drizzleDb.select().from(schema.plots).where(and(eq(schema.plots.storyId, storyId), eq(schema.plots.isDeleted, false))).all(),
      ]);
      const source = (type: MentionTextSource['type'], row: { id: string }, fields: MentionTextSource['fields']): MentionTextSource => ({ type, id: row.id, name: names.get(`${type}:${row.id}`) ?? '', fields });
      const sources: MentionTextSource[] = [
        ...characters.map((row) => source('Character', row, { description: row.description, personality: row.personality, motivation: row.motivation, qualities: row.qualities, weaknesses: row.weaknesses, biography: row.biography, plannedTimeline: row.plannedTimeline, extraNotes: row.extraNotes })),
        ...locations.map((row) => source('Location', row, { description: row.description, climate: row.climate, culture: row.culture, politics: row.politics, extraNotes: row.extraNotes })),
        ...items.map((row) => source('Item', row, { description: row.description, extraNotes: row.extraNotes })),
        ...scenes.map((row) => source('Scene', row, { summary: row.summary, extraNotes: row.extraNotes })),
        ...chapters.map((row) => source('Chapter', row, { summary: row.summary, extraNotes: row.extraNotes })),
        ...notes.map((row) => source('Note', row, { body: row.body, extraNotes: row.extraNotes })),
        ...worldRules.map((row) => source('WorldRule', row, { description: row.description, extraNotes: row.extraNotes })),
        ...plots.map((row) => source('Plot', row, { details: row.details })),
      ];
      if (token !== loadToken.current) return;
      setMatcher(nextMatcher);
      setBacklinks(buildMentionBacklinkIndex(sources, nextMatcher));
    } catch (error) {
      console.error('Failed to build the mention matcher:', error);
      if (token === loadToken.current) {
        setMatcher(EMPTY_MENTION_MATCHER);
        setBacklinks(new Map());
      }
    }
  }, [drizzleDb, enabled, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    if (!enabled) return;
    for (const event of CHANGE_EVENTS) entityEventEmitter.on(event, reload);
    return () => {
      for (const event of CHANGE_EVENTS) entityEventEmitter.off(event, reload);
    };
  }, [reload, enabled]);

  return (
    <MentionMatcherContext.Provider value={matcher}>
      <MentionBacklinksContext.Provider value={backlinks}>{children}</MentionBacklinksContext.Provider>
    </MentionMatcherContext.Provider>
  );
};
