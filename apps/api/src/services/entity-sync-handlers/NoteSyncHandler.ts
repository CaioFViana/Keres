import { CreateNoteDataSchema, CreateNoteDataType, CreateStoryUpdate, PartialNoteSchema, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { notes } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class NoteSyncHandler extends BaseSyncEntityHandler<typeof CreateNoteDataSchema, typeof PartialNoteSchema> {
  entityName = 'Note';

  constructor() {
    super(
      'notes', // Pass table name as string
      'id',
      'version',
      CreateNoteDataSchema,
      PartialNoteSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(): Promise<void> {
    // Currently no related entities to validate for Note
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateNoteDataType = this.createSchema.parse(update.data);

    const currentNote = await this.findById(update.id!);
    if (currentNote) {
      throw new Error(`Conflict: Note with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities();

    await db.insert(notes).values({
      id: update.id!, // Explicitly provide ID from update, as it's a ULID from client
      storyId: storyId, // Ensure storyId is set from the context
      ...validatedData, // Spread the validated data from the client
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);
    await this.validateRelatedEntities();

    await db.update(notes)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(notes.id, update.id!),
        eq(notes.version, currentEntity.version)
      ));
  }
}
