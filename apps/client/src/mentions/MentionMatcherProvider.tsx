import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DrizzleContext } from '../db';
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
import { MentionMatcherContext } from './MentionContext';

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

  const storyId = selectedStory?.id;
  const enabled =
    Boolean(storyId) && Boolean(drizzleDb) && selectedStory?.autoLinkMentions === true;

  /** Guards against an earlier load resolving after a later one and overwriting it. */
  const loadToken = useRef(0);

  const reload = useCallback(async () => {
    const token = ++loadToken.current;
    if (!enabled || !storyId || !drizzleDb) {
      setMatcher(EMPTY_MENTION_MATCHER);
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
      if (token !== loadToken.current) return;
      setMatcher(buildMentionMatcher(perType.flat()));
    } catch (error) {
      console.error('Failed to build the mention matcher:', error);
      if (token === loadToken.current) setMatcher(EMPTY_MENTION_MATCHER);
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
    <MentionMatcherContext.Provider value={matcher}>{children}</MentionMatcherContext.Provider>
  );
};
