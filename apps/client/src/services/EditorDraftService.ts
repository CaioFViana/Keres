import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { editorDrafts } from '../db/schema';
import { createULID } from '../utils/entityUtils';

/**
 * Client-only work-in-progress store: scene prose, canvas drawings, unfinished form queues.
 *
 * It deliberately lives outside every shared mechanism - no sync handler, no export collection,
 * no operation log. Drafts die with the story's local copy (`STORY_CHILD_TABLES`) and never
 * reach the server.
 */

export const CANVAS_DRAFT_FIELD = 'content';
export const SECONDARY_DRAFT_FIELD = 'secondary';
export const SCENE_BODY_DRAFT_FIELD = 'body';

export interface EditorDraftRow {
  content: string;
  updatedAt: Date;
}

export async function readEditorDraft(
  db: AppDrizzleClient,
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
): Promise<EditorDraftRow | null> {
  const row = await db.query.editorDrafts.findFirst({
    where: and(
      eq(editorDrafts.storyId, storyId),
      eq(editorDrafts.entityType, entityType),
      eq(editorDrafts.entityId, entityId),
      eq(editorDrafts.field, field),
    ),
    columns: { content: true, updatedAt: true },
  });
  return row ?? null;
}

export async function writeEditorDraft(
  db: AppDrizzleClient,
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
  content: string,
): Promise<void> {
  await db
    .insert(editorDrafts)
    .values({
      id: createULID(),
      storyId,
      entityType,
      entityId,
      field,
      content,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        editorDrafts.storyId,
        editorDrafts.entityType,
        editorDrafts.entityId,
        editorDrafts.field,
      ],
      set: { content, updatedAt: new Date() },
    });
}

export async function clearEditorDraft(
  db: AppDrizzleClient,
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
): Promise<void> {
  await db
    .delete(editorDrafts)
    .where(
      and(
        eq(editorDrafts.storyId, storyId),
        eq(editorDrafts.entityType, entityType),
        eq(editorDrafts.entityId, entityId),
        eq(editorDrafts.field, field),
      ),
    );
}

export async function clearStoryEditorDrafts(
  db: AppDrizzleClient,
  storyId: string,
): Promise<number> {
  const removed = await db
    .delete(editorDrafts)
    .where(eq(editorDrafts.storyId, storyId))
    .returning({ id: editorDrafts.id });
  return removed.length;
}

export async function clearAllEditorDrafts(db: AppDrizzleClient): Promise<number> {
  const removed = await db.delete(editorDrafts).returning({ id: editorDrafts.id });
  return removed.length;
}

/**
 * Module-level database handle for callers that cannot take one - the zustand draft stores and
 * the standalone secondary-draft functions. Bound once at startup next to `setAuthDb`, cleared
 * on sign-out/reset. Same pattern as `AuthTokenManager.setAuthDb`, for the same reason: these
 * call sites predate SQLite-backed drafts and have no `db` to pass.
 */
let boundDb: AppDrizzleClient | null = null;

export const setEditorDraftDb = (db: AppDrizzleClient | null): void => {
  boundDb = db;
};

export function isEditorDraftDbBound(): boolean {
  return boundDb !== null;
}

/** Test helper: drop a bound database so one suite cannot leak it into the next. */
export function resetEditorDraftDbForTests(): void {
  boundDb = null;
  for (const timer of pendingWrites.values()) clearTimeout(timer);
  pendingWrites.clear();
}

/** In-flight durable writes, keyed so rapid edits coalesce. */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const WRITE_DEBOUNCE_MS = 400;

const scheduleKey = (
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
): string => `${storyId}\n${entityType}\n${entityId}\n${field}`;

function warnUnbound(caller: string): void {
  console.warn(`EditorDraftService: no database bound, ${caller} is a no-op (legacy fallback).`);
}

export function scheduleWriteEditorDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
  content: string,
): void {
  const db = boundDb;
  if (!db) {
    warnUnbound('scheduleWriteEditorDraft');
    return;
  }
  const key = scheduleKey(storyId, entityType, entityId, field);
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing);
  pendingWrites.set(
    key,
    setTimeout(() => {
      pendingWrites.delete(key);
      void writeEditorDraft(db, storyId, entityType, entityId, field, content).catch((error) => {
        console.error('Failed to write editor draft:', error);
      });
    }, WRITE_DEBOUNCE_MS),
  );
}

export async function writeEditorDraftNow(
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
  content: string,
): Promise<boolean> {
  const db = boundDb;
  if (!db) {
    warnUnbound('writeEditorDraftNow');
    return false;
  }
  const key = scheduleKey(storyId, entityType, entityId, field);
  const existing = pendingWrites.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingWrites.delete(key);
  }
  await writeEditorDraft(db, storyId, entityType, entityId, field, content);
  return true;
}

export async function readBoundEditorDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
): Promise<EditorDraftRow | null> {
  if (!boundDb) return null;
  return readEditorDraft(boundDb, storyId, entityType, entityId, field);
}

export async function clearBoundEditorDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  field: string,
): Promise<void> {
  if (!boundDb) return;
  const key = scheduleKey(storyId, entityType, entityId, field);
  const existing = pendingWrites.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingWrites.delete(key);
  }
  await clearEditorDraft(boundDb, storyId, entityType, entityId, field);
}

export async function clearAllBoundEditorDrafts(): Promise<void> {
  if (!boundDb) return;
  for (const timer of pendingWrites.values()) clearTimeout(timer);
  pendingWrites.clear();
  await clearAllEditorDrafts(boundDb);
}
