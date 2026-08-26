/**
 * A state change that a Scene or Choice causes when it is reached/chosen - the "write" side that
 * the `ChoiceCheck`s (the "read" side) evaluate. Polymorphic like `Comment`
 * (`entityType`/`entityId`), with no database FK for `entityId`.
 *
 * - `itemGrant`/`itemTake`: use `itemId`
 * - `triggerSet`/`triggerUnset`: use `triggerName`
 */
export interface Effect {
  id: string;
  storyId: string;
  entityType: 'Scene' | 'Choice';
  entityId: string;
  effectType: 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';
  itemId: string | null;
  triggerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
