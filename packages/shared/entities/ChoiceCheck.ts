/**
 * A raw condition inside a `ChoiceCheckGroup`. A single table with nullable columns per type
 * (the same pattern as `Comment.fieldId`/`fieldKey`) - exactly the subset of fields relevant to
 * `type` is filled in:
 * - `sceneCount`: `sceneId` + `minVisits`
 * - `inventory`: `itemId` + `itemPresence`
 * - `trigger`: `triggerName` + `triggerState`
 *
 * `mode` decides which way the condition reads: in `block`, a true condition blocks the choice;
 * in `enable`, a true condition is what enables it.
 */
export interface ChoiceCheck {
  id: string;
  storyId: string;
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
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
