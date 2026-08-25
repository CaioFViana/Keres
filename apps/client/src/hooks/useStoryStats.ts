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
import { resolveLadder, type StatTier } from '@keres/shared/graphs/statLadder';
import { indexStatValues, type StatValueIndex } from '../utils/statValues';

/**
 * Tudo que uma tela de status precisa, numa consulta só e atualizado por evento.
 *
 * Painel do personagem, comparação e ranking leem os mesmos quatro conjuntos; buscar cada um
 * por conta própria multiplicaria as consultas e abriria espaço para as telas discordarem sobre
 * qual escada vale para um status.
 */
export interface StoryStatsData {
  /** Os personagens da história, para legenda e ranking sem uma segunda consulta. */
  characters: CharacterSelect[];
  stats: StatSelect[];
  primaryStats: StatSelect[];
  strengths: StatStrengthSelect[];
  modes: ModeSelect[];
  values: StatRelationSelect[];
  valueIndex: StatValueIndex;
  /** A escada que vale para um status: a própria, ou a padrão da história. */
  ladderOf: (statId: string) => StatTier[];
  /** A escada padrão da história, editável na tela dedicada. */
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

  useEffect(() => {
    reload();
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
      // `resolveLadder` com um id que nenhum status tem devolve sempre a escada padrão.
      defaultLadder: resolveLadder('', data.strengths),
      loading,
      reload,
    };
  }, [data, loading, reload]);
}
