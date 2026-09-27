import type { StoryType, SyncDevice } from './syncDevices';

/** What every group of fuzz edits draws from: the seed's randomness and the history it logs. */
export interface FuzzContext {
  random: () => number;
  pick: <T>(items: readonly T[]) => T;
  log: string[];
  storyType: StoryType;
  chapterIds: readonly string[];
  next: () => number;
}

export const short = (id: string) => id.slice(-2);

/** A device's live rows of one entity type in the fuzz story. */
export const live = async (device: SyncDevice, entityType: string) =>
  (await device.rowsOf(entityType)).filter((row) => !row.isDeleted) as Record<string, any>[];

/**
 * What the services refuse up front, with nothing written - a user would see a message and move
 * on. Anything else a service throws fails the seed.
 */
const REFUSED_LOCALLY = [
  /open stretch/,
  /Invalid route/,
  /Routes are only/,
  /Route not found|Comment not found/,
  /Only the comment author/,
  /cycle/i,
  /default arc cannot be deleted/,
  // A link this device already holds: the screens refuse making it twice.
  /relation for .* already exists with ID/,
  /a connection between these Locations already exists/,
  /scene is already part of this plot/,
  /Plot and scene must belong to the active story/,
];

/** Logs an edit and runs it; a local refusal is logged and skipped. */
export function attemptFor(log: string[]) {
  return async (device: SyncDevice, description: string, write: () => Promise<unknown>) => {
    log.push(`${device.name} ${description}`);
    try {
      await write();
    } catch (error) {
      const message = String((error as Error)?.message);
      if (!REFUSED_LOCALLY.some((pattern) => pattern.test(message))) throw error;
      log.push(`  refused locally: ${message}`);
    }
  };
}

/** An edit the fuzz may make: what it logs, and the write. */
export type FuzzStep = readonly [description: string, write: () => Promise<unknown>];

/**
 * One kind of row the fuzz makes, changes and removes. `create` answers null when what it needs
 * (a character, two locations...) is missing on the device.
 */
export interface RowSpec {
  entityType: string;
  create: (device: SyncDevice) => Promise<FuzzStep | null>;
  change?: (device: SyncDevice, row: Record<string, any>) => FuzzStep;
  remove: (device: SyncDevice, row: Record<string, any>) => FuzzStep;
}

/**
 * Picks one of `specs` uniformly, then creates, changes or removes one of its rows - removing
 * as often as changing, so every row a device holds is as likely to go as to be edited.
 */
export function rowEditsFor(context: FuzzContext, specs: readonly RowSpec[]) {
  const { random, pick, log } = context;
  const attempt = attemptFor(log);
  return async (device: SyncDevice) => {
    const spec = pick(specs);
    const rows = await live(device, spec.entityType);
    const roll = random();
    let step: FuzzStep | null;
    if (rows.length === 0 || roll < 0.4) {
      step = await spec.create(device);
    } else {
      const row = pick(rows);
      step = spec.change && roll < 0.7 ? spec.change(device, row) : spec.remove(device, row);
    }
    if (step) await attempt(device, step[0], step[1]);
  };
}
