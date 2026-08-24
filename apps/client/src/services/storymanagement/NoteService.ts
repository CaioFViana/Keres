import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { NoteInsert, NoteSelect } from '../../db/schemas/notes';
import { notes } from '../../db/schemas/notes';
import { tagRelations } from '../../db/schemas/tagRelations';
import type { TagSelect } from '../../db/schemas/tags';
import { tags } from '../../db/schemas/tags'; // Import tags schema
import type { Create} from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

export type NoteWithTags = NoteSelect & {
  tags: TagSelect[];
};

export type { FavoriteFilterState };

export interface NoteService {
  getNotesByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<NoteWithTags[]>;
  getById(noteId: string): Promise<NoteWithTags | undefined>;
  createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect>;
  updateNote(
    currentUserId: string,
    noteId: string,
    noteData: Partial<
      Omit<
        NoteInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<void>;
  deleteNote(currentUserId: string, noteId: string): Promise<void>;
}

export const createNoteService = (db: AppDrizzleClient): NoteService => {
  const serverService = createServerService(db);
  return {
    async getNotesByStoryId(
      storyId,
      searchTerm,
      activeFilterTags,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<NoteWithTags[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(notes.storyId, storyId) as SQL<boolean>,
        eq(notes.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(
          sql`${notes.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      if (activeFilterTags && activeFilterTags.length > 0) {
        // Filter notes by tags
        const noteIdsWithActiveTags = await db
          .select({ noteId: tagRelations.relationId })
          .from(tagRelations)
          .where(
            and(
              eq(tagRelations.storyId, storyId),
              eq(tagRelations.relationType, 'Note'),
              inArray(tagRelations.tagId, activeFilterTags),
            ),
          )
          .execute();

        const filteredNoteIds = noteIdsWithActiveTags.map((row) => row.noteId);

        if (filteredNoteIds.length > 0) {
          conditions.push(inArray(notes.id, filteredNoteIds) as SQL<boolean>);
        } else {
          return [];
        }
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(notes.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(notes.isFavorite, false) as SQL<boolean>);
      }

      // Apply advanced search criteria
      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const noteMetadata = entityFieldMetadata['Note'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = noteMetadata.find((meta) => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(
                  sql`${notes[key as keyof NoteSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>,
                );
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(notes[key as keyof NoteSelect], value) as SQL<boolean>);
              }
            } else if (value !== undefined && value !== '') {
              const customCondition = await buildCustomAttributeSearchCondition(
                db,
                notes.id,
                key,
                value,
              );
              if (customCondition) {
                conditions.push(customCondition);
              }
            }
          }
        }
      }

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      const query = db
        .select({
          note: notes,
          tag: tags,
        })
        .from(notes)
        .leftJoin(
          tagRelations,
          and(
            eq(tagRelations.relationId, notes.id),
            eq(tagRelations.relationType, 'Note'),
            eq(tagRelations.isDeleted, false),
          ),
        )
        .leftJoin(tags, and(eq(tags.id, tagRelations.tagId), eq(tags.isDeleted, false)))
        .where(and(...finalConditions))
        .$dynamic();

      let resultQuery = query;

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'title':
            resultQuery = resultQuery.orderBy(orderBy(notes.title));
            break;
          case 'createdAt':
            resultQuery = resultQuery.orderBy(orderBy(notes.createdAt));
            break;
          case 'updatedAt':
            resultQuery = resultQuery.orderBy(orderBy(notes.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        resultQuery = resultQuery.orderBy(asc(notes.title));
      }

      const rawResults = await resultQuery.all();

      const notesMap = new Map<string, NoteWithTags>();

      for (const row of rawResults) {
        if (!row.note) continue;

        let note = notesMap.get(row.note.id);
        if (!note) {
          note = { ...row.note, tags: [] };
          notesMap.set(row.note.id, note);
        }

        if (row.tag && row.tag.id) {
          note.tags.push(row.tag);
        }
      }

      return Array.from(notesMap.values());
    },

    async getById(noteId: string): Promise<NoteWithTags | undefined> {
      const rawResults = await db
        .select({
          note: notes,
          tag: tags,
        })
        .from(notes)
        .leftJoin(
          tagRelations,
          and(
            eq(tagRelations.relationId, notes.id),
            eq(tagRelations.relationType, 'Note'),
            eq(tagRelations.isDeleted, false),
          ),
        )
        .leftJoin(tags, and(eq(tags.id, tagRelations.tagId), eq(tags.isDeleted, false)))
        .where(and(eq(notes.id, noteId), eq(notes.isDeleted, false)))
        .all();

      if (rawResults.length === 0) {
        return undefined;
      }

      const noteMap = new Map<string, NoteWithTags>();

      for (const row of rawResults) {
        if (!row.note) continue;

        let note = noteMap.get(row.note.id);
        if (!note) {
          note = { ...row.note, tags: [] };
          noteMap.set(row.note.id, note);
        }

        if (row.tag && row.tag.id) {
          note.tags.push(row.tag);
        }
      }

      return decorateFavorite(db, 'Note', noteMap.get(noteId));
    },

    async createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect> {
      await assertStoryIsWritable(db, noteData.storyId);
      let newNote = prepareNewEntityData<NoteInsert>(noteData);
      const favorite = await normalizeFavoriteCreate(db, newNote.storyId, 'Note', newNote);
      newNote = favorite.data;
      const result = await db.insert(notes).values(newNote).returning().get();
      await persistInitialFavorite(
        db,
        newNote.storyId,
        newNote.id,
        'Note',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newNote.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, newNote.storyId, userIdToLog, 'create', 'Note', newNote.id, {
        ...result,
      });
      entityEventEmitter.emit('note_changed', newNote.storyId, newNote.id);

      return result;
    },

    async updateNote(
      currentUserId: string,
      noteId: string,
      noteData: Partial<
        Omit<
          NoteInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<void> {
      const originalNote = await db.query.notes.findFirst({ where: eq(notes.id, noteId) });
      if (!originalNote) {
        throw new Error(`Note with ID ${noteId} not found for update.`);
      }
      await assertStoryIsWritable(db, originalNote.storyId);
      noteData = await normalizeFavoriteUpdate(
        db,
        originalNote.storyId,
        noteId,
        'Note',
        currentUserId,
        noteData,
      );

      // Create a potential new state for diffing, including only fields that might change
      const potentialNewState = { ...originalNote, ...noteData };

      // Calculate changes, ignoring the version and updatedAt fields for the purpose of deciding to update
      const changes = getChangedFields(originalNote, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for note ${noteId}. Skipping update and operation log.`,
        );
        return; // Return early if no significant changes
      }

      const [updatedNote] = await db
        .update(notes)
        .set({ ...noteData, updatedAt: new Date(), version: sql`${notes.version} + 1` })
        .where(eq(notes.id, noteId))
        .returning({ id: notes.id, storyId: notes.storyId, version: notes.version });

      if (!updatedNote) {
        throw new Error(`Failed to update note ${noteId} or note not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedNote.storyId,
        currentUserId,
      );
      // Log the diff already computed above, not the raw `noteData` input - the input has
      // every field the form sends, changed or not.
      await recordLocalOperation(db, updatedNote.storyId, userIdToLog, 'update', 'Note', noteId, {
        ...changes,
        version: updatedNote.version,
      });
      entityEventEmitter.emit('note_changed', updatedNote.storyId, updatedNote.id);
    },

    async deleteNote(currentUserId: string, noteId: string): Promise<void> {
      const noteToDelete = await db.query.notes.findFirst({ where: eq(notes.id, noteId) });
      if (!noteToDelete) {
        console.warn(`Attempted to delete non-existent note ${noteId}.`);
        return;
      }
      await assertStoryIsWritable(db, noteToDelete.storyId);

      const [updatedNote] = await db
        .update(notes)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${notes.version} + 1`,
        })
        .where(eq(notes.id, noteId))
        .returning({
          id: notes.id,
          storyId: notes.storyId,
          isDeleted: notes.isDeleted,
          version: notes.version,
        });

      if (!updatedNote) {
        throw new Error(`Failed to delete note ${noteId} or note not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedNote.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, updatedNote.storyId, userIdToLog, 'delete', 'Note', noteId, {
        id: updatedNote.id,
        isDeleted: updatedNote.isDeleted,
        version: updatedNote.version,
      });
      entityEventEmitter.emit('note_changed', updatedNote.storyId, updatedNote.id);
    },
  };
};
