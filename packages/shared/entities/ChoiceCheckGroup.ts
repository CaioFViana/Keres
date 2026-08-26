/**
 * A group of conditions (`ChoiceCheck`) that have to be satisfied for a Choice to become
 * available. The checks inside a group combine through the group's `combinator` (AND = all,
 * OR = any); the groups of the same Choice combine with AND between them.
 */
export interface ChoiceCheckGroup {
  id: string;
  storyId: string;
  choiceId: string;
  combinator: 'AND' | 'OR';
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
