import { describe, expect, it } from 'vitest';
import { READER_ENGINE_SOURCE } from '../../../manuscript/reader/readerEngine';
import {
  applySimulationEffects,
  emptyStorySimulationState,
  enterSimulatedScene,
  evaluateSimulatedChoice,
  type StorySimulationState,
} from '../../../utils/storySimulation';

type Check = {
  id: string;
  groupId: string;
  order: number;
  mode: 'block' | 'enable';
  type: 'sceneCount' | 'inventory' | 'trigger';
  sceneId: string | null;
  minVisits: number | null;
  itemId: string | null;
  itemPresence: 'has' | 'lacks' | null;
  triggerName: string | null;
  triggerState: 'set' | 'unset' | null;
  isDeleted: boolean;
};
type Effect = {
  id: string;
  entityType: 'Scene' | 'Choice';
  entityId: string;
  effectType: 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';
  itemId: string | null;
  triggerName: string | null;
  isDeleted: boolean;
};
type ReaderState = { visits: Record<string, number>; inventory: string[]; triggers: string[] };
type Engine = {
  emptyState: () => ReaderState;
  matches: (check: unknown, state: ReaderState) => boolean;
  isAvailable: (groups: unknown[], state: ReaderState) => boolean;
  applyEffects: (state: ReaderState, effects: unknown[]) => ReaderState;
  enterScene: (state: ReaderState, sceneId: string, effects: unknown[]) => ReaderState;
};

const engine = new Function(`${READER_ENGINE_SOURCE}; return KeresEngine;`)() as Engine;

const SCENES = ['s1', 's2', 's3'];
const ITEMS = ['i1', 'i2'];
const TRIGGERS = ['t1', 't2'];

/** A small, seeded generator: the same run every time, so a failure can be replayed. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sameState(reader: ReaderState, shared: StorySimulationState) {
  expect(Object.fromEntries(shared.sceneVisits)).toEqual(reader.visits);
  expect([...shared.inventory].sort()).toEqual([...reader.inventory].sort());
  expect([...shared.triggers].sort()).toEqual([...reader.triggers].sort());
}

function pick<T>(next: () => number, list: readonly T[]): T {
  return list[Math.floor(next() * list.length)]!;
}

describe('the reader engine agrees with the shared simulation', () => {
  it('answers every check, group and effect the way storySimulation does', () => {
    const next = random(20260928);
    for (let round = 0; round < 400; round += 1) {
      // A run: effects drift the state while the choices are asked at every step.
      let reader = engine.emptyState();
      let shared = emptyStorySimulationState();
      for (let step = 0; step < 6; step += 1) {
        const effects: Effect[] = Array.from({ length: Math.floor(next() * 3) }, (_, index) => {
          const effectType = pick(next, [
            'itemGrant',
            'itemTake',
            'triggerSet',
            'triggerUnset',
          ] as const);
          return {
            id: `e${index}`,
            entityType: 'Choice',
            entityId: 'c',
            effectType,
            itemId: effectType.startsWith('item') ? pick(next, ITEMS) : null,
            triggerName: effectType.startsWith('trigger') ? pick(next, TRIGGERS) : null,
            isDeleted: false,
          };
        });
        reader = engine.applyEffects(reader, effects);
        shared = applySimulationEffects(shared, effects);
        const sceneId = pick(next, SCENES);
        const sceneEffects = effects.slice(0, 1);
        reader = engine.enterScene(reader, sceneId, sceneEffects);
        shared = enterSimulatedScene(shared, sceneId, sceneEffects);
        sameState(reader, shared);

        const groups = Array.from({ length: Math.floor(next() * 3) }, (_, groupIndex) => ({
          id: `g${groupIndex}`,
          choiceId: 'c',
          combinator: pick(next, ['AND', 'OR'] as const),
          isDeleted: false,
          order: groupIndex,
        }));
        const checks: Check[] = groups.flatMap((group) =>
          Array.from({ length: Math.floor(next() * 4) }, (_, index) => {
            const type = pick(next, ['sceneCount', 'inventory', 'trigger'] as const);
            return {
              id: `${group.id}-${index}`,
              groupId: group.id,
              order: index,
              mode: pick(next, ['block', 'enable'] as const),
              type,
              sceneId: type === 'sceneCount' ? pick(next, SCENES) : null,
              minVisits: type === 'sceneCount' ? pick(next, [null, 1, 2]) : null,
              itemId: type === 'inventory' ? pick(next, ITEMS) : null,
              itemPresence: type === 'inventory' ? pick(next, ['has', 'lacks'] as const) : null,
              triggerName: type === 'trigger' ? pick(next, TRIGGERS) : null,
              triggerState: type === 'trigger' ? pick(next, ['set', 'unset'] as const) : null,
              isDeleted: false,
            };
          }),
        );
        const expected = evaluateSimulatedChoice({ id: 'c' }, groups, checks, shared).available;
        const readerGroups = groups.map((group) => ({
          combinator: group.combinator,
          checks: checks.filter((check) => check.groupId === group.id),
        }));
        expect(engine.isAvailable(readerGroups, reader)).toBe(expected);
        for (const check of checks) {
          const single = evaluateSimulatedChoice(
            { id: 'c' },
            [{ id: 'g', choiceId: 'c', combinator: 'AND', isDeleted: false, order: 0 }],
            [{ ...check, groupId: 'g', mode: 'enable' }],
            shared,
          ).available;
          expect(engine.matches(check, reader)).toBe(single);
        }
      }
    }
  });

  it('does not mutate the state it is given', () => {
    const state = engine.emptyState();
    const after = engine.enterScene(
      engine.applyEffects(state, [{ effectType: 'itemGrant', itemId: 'i1' }]),
      's1',
      [{ effectType: 'triggerSet', triggerName: 't1' }],
    );
    expect(state).toEqual({ visits: {}, inventory: [], triggers: [] });
    expect(after).toEqual({ visits: { s1: 1 }, inventory: ['i1'], triggers: ['t1'] });
  });

  it('reads an open choice, an empty group and a lone unmet check like the simulation', () => {
    const state = engine.emptyState();
    expect(engine.isAvailable([], state)).toBe(true);
    expect(engine.isAvailable([{ combinator: 'AND', checks: [] }], state)).toBe(true);
    expect(engine.isAvailable([{ combinator: 'OR', checks: [] }], state)).toBe(false);
  });
});
