import { createCharacterSceneService } from '../../src/services/storymanagement/CharacterSceneService';
import { createChoiceCheckGroupService } from '../../src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../src/services/storymanagement/ChoiceCheckService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { createItemJourneyService } from '../../src/services/storymanagement/ItemJourneyService';
import { createModeService } from '../../src/services/storymanagement/ModeService';
import { createPlotSceneService } from '../../src/services/storymanagement/PlotSceneService';
import { createStatRelationService } from '../../src/services/storymanagement/StatRelationService';
import { createStatStrengthService } from '../../src/services/storymanagement/StatStrengthService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { STORY_ID, type SyncDevice, USER_ID } from './syncDevices';
import {
  attemptFor,
  type FuzzContext,
  live,
  type RowSpec,
  rowEditsFor,
  short,
} from './syncFuzzSupport';

/**
 * The convergence fuzz's narrative edits: what ties the story's things to its scenes and to each
 * other - who appears in a scene, which plot a scene serves, where an item changes hands, a
 * character's modes and stat values, the strength ladders, the story's own title - and, in a
 * branching story, choices between scenes with their checks and the effects scenes have.
 */

const db = (device: SyncDevice) => device.database.db;

export function createNarrativeEdits(context: FuzzContext) {
  const { random, pick, log, storyType, next } = context;
  const attempt = attemptFor(log);

  /** One live row of each type, or null when any of them has none. */
  const liveOf = async (device: SyncDevice, ...entityTypes: string[]) => {
    const picked: Record<string, any>[] = [];
    for (const entityType of entityTypes) {
      const rows = await live(device, entityType);
      if (rows.length === 0) return null;
      picked.push(pick(rows));
    }
    return picked;
  };

  const LINKS: RowSpec[] = [
    {
      entityType: 'CharacterScene',
      create: async (device) => {
        const picked = await liveOf(device, 'Character', 'Scene');
        if (!picked) return null;
        const [character, scene] = picked as [Record<string, any>, Record<string, any>];
        return [
          `puts ${short(character.id)} in scene ${short(scene.id)}`,
          () =>
            createCharacterSceneService(db(device)).saveCharacterScene(USER_ID, {
              storyId: STORY_ID,
              characterId: character.id,
              sceneId: scene.id,
            } as never),
        ];
      },
      remove: (device, row) => [
        `takes ${short(row.characterId)} out of scene ${short(row.sceneId)}`,
        () => createCharacterSceneService(db(device)).deleteCharacterScene(USER_ID, row.id),
      ],
    },
    {
      entityType: 'PlotScene',
      create: async (device) => {
        const picked = await liveOf(device, 'Plot', 'Scene');
        if (!picked) return null;
        const [plot, scene] = picked as [Record<string, any>, Record<string, any>];
        return [
          `ties scene ${short(scene.id)} to plot ${short(plot.id)}`,
          () =>
            createPlotSceneService(db(device)).save(USER_ID, {
              storyId: STORY_ID,
              plotId: plot.id,
              sceneId: scene.id,
              note: `${device.name}-${next()}`,
            }),
        ];
      },
      change: (device, row) => {
        const note = `${device.name}-${next()}`;
        return [
          `notes plot scene ${short(row.id)}=${note}`,
          () =>
            createPlotSceneService(db(device)).save(USER_ID, {
              id: row.id,
              storyId: STORY_ID,
              plotId: row.plotId,
              sceneId: row.sceneId,
              note,
            }),
        ];
      },
      remove: (device, row) => [
        `unties plot scene ${short(row.id)}`,
        () => createPlotSceneService(db(device)).delete(USER_ID, row.id),
      ],
    },
    {
      entityType: 'ItemJourney',
      create: async (device) => {
        const picked = await liveOf(device, 'Item', 'Scene');
        if (!picked) return null;
        const [item, scene] = picked as [Record<string, any>, Record<string, any>];
        return [
          `moves item ${short(item.id)} in scene ${short(scene.id)}`,
          () =>
            createItemJourneyService(db(device)).createItemJourney(USER_ID, {
              storyId: STORY_ID,
              itemId: item.id,
              sceneId: scene.id,
              newCharacterOwnerId: null,
              newState: `${device.name}-state-${next()}`,
              extraNotes: null,
            } as never),
        ];
      },
      change: (device, row) => {
        const newState = `${device.name}-state-${next()}`;
        return [
          `changes journey ${short(row.id)}=${newState}`,
          () =>
            createItemJourneyService(db(device)).updateItemJourney(USER_ID, row.id, { newState }),
        ];
      },
      remove: (device, row) => [
        `deletes journey ${short(row.id)}`,
        () => createItemJourneyService(db(device)).deleteItemJourney(USER_ID, row.id),
      ],
    },
    {
      entityType: 'Mode',
      create: async (device) => {
        const picked = await liveOf(device, 'Character');
        if (!picked) return null;
        const [character] = picked as [Record<string, any>];
        const name = `${device.name}-mode-${next()}`;
        return [
          `gives ${short(character.id)} mode ${name}`,
          () =>
            createModeService(db(device)).createMode(USER_ID, {
              storyId: STORY_ID,
              characterId: character.id,
              name,
              order: 0,
            } as never),
        ];
      },
      change: (device, row) => {
        const name = `${device.name}-mode-${next()}`;
        return [
          `renames mode ${short(row.id)}=${name}`,
          () => createModeService(db(device)).updateMode(USER_ID, row.id, { name }),
        ];
      },
      remove: (device, row) => [
        `deletes mode ${short(row.id)}`,
        () => createModeService(db(device)).deleteMode(USER_ID, row.id),
      ],
    },
    {
      entityType: 'StatRelation',
      create: async (device) => {
        const picked = await liveOf(device, 'Character', 'Stat');
        if (!picked) return null;
        const [character, stat] = picked as [Record<string, any>, Record<string, any>];
        const modes = (await live(device, 'Mode')).filter(
          (mode) => mode.characterId === character.id,
        );
        const modeId = modes.length > 0 && random() < 0.4 ? pick(modes).id : null;
        const value = Math.floor(random() * 10);
        return [
          `sets ${short(character.id)}.${short(stat.id)}@${modeId ? short(modeId) : 'normal'}=${value}`,
          () =>
            createStatRelationService(db(device)).setValue(USER_ID, {
              storyId: STORY_ID,
              characterId: character.id,
              modeId,
              statId: stat.id,
              value,
            }),
        ];
      },
      change: (device, row) => {
        const value = Math.floor(random() * 10);
        return [
          `resets stat value ${short(row.id)}=${value}`,
          () =>
            createStatRelationService(db(device)).setValue(USER_ID, {
              storyId: STORY_ID,
              characterId: row.characterId,
              modeId: row.modeId,
              statId: row.statId,
              value,
            }),
        ];
      },
      remove: (device, row) => [
        `clears stat value ${short(row.id)}`,
        () =>
          createStatRelationService(db(device)).clearValue(USER_ID, {
            characterId: row.characterId,
            modeId: row.modeId,
            statId: row.statId,
          }),
      ],
    },
    {
      entityType: 'StatStrength',
      create: async (device) => {
        const stats = await live(device, 'Stat');
        const statId = stats.length > 0 && random() < 0.5 ? pick(stats).id : null;
        const label = `${device.name}-tier-${next()}`;
        return [
          `adds tier ${label}`,
          () =>
            createStatStrengthService(db(device)).createStrength(USER_ID, {
              storyId: STORY_ID,
              statId,
              label,
              minValue: Math.floor(random() * 10),
            } as never),
        ];
      },
      change: (device, row) => {
        const label = `${device.name}-tier-${next()}`;
        return [
          `renames tier ${short(row.id)}=${label}`,
          () => createStatStrengthService(db(device)).updateStrength(USER_ID, row.id, { label }),
        ];
      },
      remove: (device, row) => [
        `deletes tier ${short(row.id)}`,
        () => createStatStrengthService(db(device)).deleteStrength(USER_ID, row.id),
      ],
    },
  ];

  /** A branching story's choices, their checks, and what scenes do. */
  const BRANCHES: RowSpec[] = [
    {
      entityType: 'Choice',
      create: async (device) => {
        const scenes = await live(device, 'Scene');
        if (scenes.length === 0) return null;
        const [from, to] = [pick(scenes), pick(scenes)];
        const text = `${device.name}-choice-${next()}`;
        return [
          `adds choice ${short(from.id)}->${short(to.id)} ${text}`,
          () =>
            createChoiceService(db(device)).createChoice(USER_ID, {
              storyId: STORY_ID,
              sceneId: from.id,
              nextSceneId: to.id,
              text,
              notes: null,
            } as never),
        ];
      },
      change: (device, row) => {
        const text = `${device.name}-choice-${next()}`;
        return [
          `rewords choice ${short(row.id)}=${text}`,
          () => createChoiceService(db(device)).updateChoice(USER_ID, row.id, { text } as never),
        ];
      },
      remove: (device, row) => [
        `deletes choice ${short(row.id)}`,
        () => createChoiceService(db(device)).deleteChoice(USER_ID, row.id),
      ],
    },
    {
      entityType: 'ChoiceCheckGroup',
      create: async (device) => {
        const picked = await liveOf(device, 'Choice');
        if (!picked) return null;
        const [choice] = picked as [Record<string, any>];
        return [
          `guards choice ${short(choice.id)}`,
          () =>
            createChoiceCheckGroupService(db(device)).createChoiceCheckGroup(USER_ID, {
              storyId: STORY_ID,
              choiceId: choice.id,
              combinator: 'AND',
              order: 0,
            }),
        ];
      },
      change: (device, row) => {
        const combinator = pick(['AND', 'OR'] as const);
        return [
          `makes group ${short(row.id)} ${combinator}`,
          () =>
            createChoiceCheckGroupService(db(device)).updateChoiceCheckGroup(USER_ID, row.id, {
              combinator,
            }),
        ];
      },
      remove: (device, row) => [
        `deletes group ${short(row.id)}`,
        () => createChoiceCheckGroupService(db(device)).deleteChoiceCheckGroup(USER_ID, row.id),
      ],
    },
    {
      entityType: 'ChoiceCheck',
      create: async (device) => {
        const picked = await liveOf(device, 'ChoiceCheckGroup');
        if (!picked) return null;
        const [group] = picked as [Record<string, any>];
        return [
          `checks a trigger in group ${short(group.id)}`,
          () =>
            createChoiceCheckService(db(device)).createChoiceCheck(USER_ID, {
              storyId: STORY_ID,
              groupId: group.id,
              mode: 'block',
              type: 'trigger',
              order: 0,
              sceneId: null,
              minVisits: null,
              itemId: null,
              itemPresence: null,
              triggerName: 'porta',
              triggerState: 'set',
            }),
        ];
      },
      change: (device, row) => {
        const triggerState = pick(['set', 'unset'] as const);
        return [
          `flips check ${short(row.id)} ${triggerState}`,
          () =>
            createChoiceCheckService(db(device)).updateChoiceCheck(USER_ID, row.id, {
              triggerState,
            }),
        ];
      },
      remove: (device, row) => [
        `deletes check ${short(row.id)}`,
        () => createChoiceCheckService(db(device)).deleteChoiceCheck(USER_ID, row.id),
      ],
    },
    {
      entityType: 'Effect',
      create: async (device) => {
        const picked = await liveOf(device, 'Scene');
        if (!picked) return null;
        const [scene] = picked as [Record<string, any>];
        return [
          `makes scene ${short(scene.id)} set a trigger`,
          () =>
            createEffectService(db(device)).createEffect(USER_ID, {
              storyId: STORY_ID,
              entityType: 'Scene',
              entityId: scene.id,
              effectType: 'triggerSet',
              itemId: null,
              triggerName: 'porta',
            }),
        ];
      },
      change: (device, row) => {
        const effectType = pick(['triggerSet', 'triggerUnset'] as const);
        return [
          `turns effect ${short(row.id)} into ${effectType}`,
          () => createEffectService(db(device)).updateEffect(USER_ID, row.id, { effectType }),
        ];
      },
      remove: (device, row) => [
        `deletes effect ${short(row.id)}`,
        () => createEffectService(db(device)).deleteEffect(USER_ID, row.id),
      ],
    },
  ];

  const linkEdit = rowEditsFor(context, LINKS);
  const branchEdit = rowEditsFor(context, BRANCHES);

  const storyEdit = async (device: SyncDevice) => {
    const title = `${device.name}-story-${next()}`;
    await attempt(device, `retitles the story ${title}`, () =>
      createStoryService(db(device)).updateStory(USER_ID, STORY_ID, { title } as never),
    );
  };

  const edit = async (device: SyncDevice) => {
    const roll = random();
    if (roll < 0.1) await storyEdit(device);
    else if (roll < 0.5 && storyType === 'branching') await branchEdit(device);
    else await linkEdit(device);
  };

  /** A mode for a character and, in a branching story, a choice with a check group. */
  const prime = async (device: SyncDevice) => {
    const [character] = await live(device, 'Character');
    if (character) {
      await createModeService(db(device)).createMode(USER_ID, {
        storyId: STORY_ID,
        characterId: character.id,
        name: 'Mode-seed',
        order: 0,
      } as never);
    }
    const scenes = await live(device, 'Scene');
    if (storyType === 'branching' && scenes.length > 1) {
      await createChoiceService(db(device)).createChoice(USER_ID, {
        storyId: STORY_ID,
        sceneId: scenes[0]!.id,
        nextSceneId: scenes[1]!.id,
        text: 'Choice-seed',
        notes: null,
      } as never);
      const [choice] = await live(device, 'Choice');
      await createChoiceCheckGroupService(db(device)).createChoiceCheckGroup(USER_ID, {
        storyId: STORY_ID,
        choiceId: choice!.id,
        combinator: 'AND',
        order: 0,
      });
    }
  };

  return Object.assign(edit, { prime });
}
