import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { NoteInsert, notes, NoteSelect } from '../db/schemas/notes';
import { Create, prepareNewEntityData } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export interface NoteService {
  getNotesByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<NoteSelect[]>;
  getById(noteId: string): Promise<NoteSelect | undefined>;
  createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect>;
  updateNote(currentUserId: string, noteId: string, noteData: Partial<Omit<NoteInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteNote(currentUserId: string, noteId: string): Promise<void>;
}

export const createNoteService = (db: AppDrizzleClient): NoteService => {
  const serverService = createServerService(db);
  return {
    async getNotesByStoryId(storyId, searchTerm, sortBy, sortDirection, favoriteFilterState, advancedSearchCriteria): Promise<NoteSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(notes.storyId, storyId) as SQL<boolean>,
        eq(notes.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${notes.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      // No activeFilterTags for Notes

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(notes.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(notes.isFavorite, false) as SQL<boolean>);
      }

      // Apply advanced search criteria
      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        // Assuming entityFieldMetadata for 'Note' exists
        const noteMetadata = entityFieldMetadata['Note'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = noteMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${notes[key as keyof NoteSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(notes[key as keyof NoteSelect], value) as SQL<boolean>);
              }
              // Add other types (number, date, etc.) as needed
            }
          }
        }
      }

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db.select().from(notes).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'title':
            query = query.orderBy(orderBy(notes.title));
            break;
          case 'createdAt':
            query = query.orderBy(orderBy(notes.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(orderBy(notes.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(asc(notes.title));
      }

      const result = await query.all();
      return result;
    },

    async getById(noteId: string): Promise<NoteSelect | undefined> {
      return db.query.notes.findFirst({
        where: and(eq(notes.id, noteId), eq(notes.isDeleted, false)),
      });
    },

    async createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect> {
      const newNote = prepareNewEntityData<NoteInsert>(noteData);
      const result = await db.insert(notes).values(newNote).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newNote.storyId, currentUserId);
      await recordLocalOperation(db, newNote.storyId, userIdToLog, 'create', 'Note', newNote.id, { ...result });
      entityEventEmitter.emit('note_changed', newNote.storyId, newNote.id);

      return result;
    },

    async updateNote(currentUserId: string, noteId: string, noteData: Partial<Omit<NoteInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const [updatedNote] = await db.update(notes)
        .set({ ...noteData, updatedAt: new Date(), version: sql`${notes.version} + 1` })
        .where(eq(notes.id, noteId))
        .returning({ id: notes.id, storyId: notes.storyId, version: notes.version });

      if (!updatedNote) {
        throw new Error(`Failed to update note ${noteId} or note not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedNote.storyId, currentUserId);
      await recordLocalOperation(db, updatedNote.storyId, userIdToLog, 'update', 'Note', noteId, {
        ...noteData,
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

      const [updatedNote] = await db.update(notes)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${notes.version} + 1` })
        .where(eq(notes.id, noteId))
        .returning({ id: notes.id, storyId: notes.storyId, isDeleted: notes.isDeleted, version: notes.version });

      if (!updatedNote) {
        throw new Error(`Failed to delete note ${noteId} or note not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedNote.storyId, currentUserId);
      await recordLocalOperation(db, updatedNote.storyId, userIdToLog, 'delete', 'Note', noteId, {
        id: updatedNote.id,
        isDeleted: updatedNote.isDeleted,
        version: updatedNote.version,
      });
      entityEventEmitter.emit('note_changed', updatedNote.storyId, updatedNote.id);
    },
  };
};