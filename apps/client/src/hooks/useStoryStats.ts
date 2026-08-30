import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type {
  CharacterSelect,
  ModeSelect,
  StatRelationSelect,
  StatSelect,
  StatStrengthSelect,
} from '../db/schema';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createModeService } from '../services/storymanagement/ModeService';
import { createStatRelationService } from '../services/storymanagement/StatRelationService';
import { createStatService } from '../services/storymanagement/StatService';
import { createStatStrengthService } from '../services/storymanagement/StatStrengthService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';
import { resolveLadder, type StatTier } from '@keres/shared/graphs/statLadder';
import { indexStatValues, type StatValueIndex } from '../utils/statValues';

/**
 * Everything a stats screen needs, in a single query and refreshed by event.
 *
 * The character panel, the comparison and the ranking read the same four sets; fetching each one on its
 * own would multiply the queries and open room for the screens to disagree about which ladder applies
 * to a stat.
 */
export interface StoryStatsData {
  /** The story's characters, for the legend and the ranking without a second query. */
  characters: CharacterSelect[];
  stats: StatSelect[];
  primaryStats: StatSelect[];
  strengths: StatStrengthSelect[];
  modes: ModeSelect[];
  values: StatRelationSelect[];
  valueIndex: StatValueIndex;
  /** The ladder that applies to a stat: its own, or the story's default. */
  ladderOf: (statId: string) => StatTier[];
  /** The story's default ladder, editable on the dedicated screen. */
  defaultLadder: StatTier[];
  loading: boolean;
  reload: () => Promise<void>;
}

const EMPTY: {
  characters: CharacterSelect[];
  stats: StatSelect[];
  strengths: StatStrengthSelect[];
  modes: ModeSelect[];
  values: StatRelationSelect[];
} = { characters: [], stats: [], strengths: [], modes: [], values: [] };

export function useStoryStats(storyId: string | undefined | null): StoryStatsData {
  const drizzleDb = useDrizzle();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const [characters, stats, strengths, modes, values] = await Promise.all([
        createCharacterService(drizzleDb).getCharactersByStoryId(storyId),
        createStatService(drizzleDb).getStatsByStoryId(storyId),
        createStatStrengthService(drizzleDb).getStrengthsByStoryId(storyId),
        createModeService(drizzleDb).getModesByStoryId(storyId),
        createStatRelationService(drizzleDb).getValuesByStoryId(storyId),
      ]);
      setData({ characters, stats, strengths, modes, values });
    } catch (error) {
      console.error('Failed to load the stat system of the story:', error);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    const events = [
      'stat_changed',
      'stat_strength_changed',
      'stat_relation_changed',
      'mode_changed',
      'character_changed',
    ];
    for (const event of events) entityEventEmitter.on(event, reload);
    return () => {
      for (const event of events) entityEventEmitter.off(event, reload);
    };
  }, [reload]);

  return useMemo(() => {
    const ladderCache = new Map<string, StatTier[]>();
    return {
      ...data,
      primaryStats: data.stats.filter((stat) => stat.isPrimary),
      valueIndex: indexStatValues(data.values),
      ladderOf: (statId: string) => {
        const cached = ladderCache.get(statId);
        if (cached) return cached;
        const ladder = resolveLadder(statId, data.strengths);
        ladderCache.set(statId, ladder);
        return ladder;
      },
      // `resolveLadder` with an id no stat has always returns the default ladder.
      defaultLadder: resolveLadder('', data.strengths),
      loading,
      reload,
    };
  }, [data, loading, reload]);
}
