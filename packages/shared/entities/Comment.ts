import type { CommentEntityType } from '../metadata/CommentEntityType';

/**
 * A comment attached to a specific field (native or custom attribute) of an entity. Exactly one
 * of `fieldId`/`fieldKey` is filled in - `fieldId` references `StorySchemaField.id` for custom
 * fields, `fieldKey` is the native property's name (e.g. "biography") for the rest.
 * `contentSnapshot` freezes the field's value at the moment of the comment, so the comment still
 * makes sense after the field is edited; `excerptText` is the relevant passage inside that
 * snapshot, typed/pasted by the author (not a real text selection - see
 * `docs/project_plan.md`/the implementation plan).
 */
export interface Comment {
  id: string;
  storyId: string;
  entityType: CommentEntityType;
  entityId: string;
  fieldId: string | null;
  fieldKey: string | null;
  contentSnapshot: string | null;
  excerptText: string | null;
  authorUserId: string;
  commentText: string;
  /** 1 = informational, 2 = relevant, 3 = attention, 4 = serious, 5 = immediate. */
  criticality: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
