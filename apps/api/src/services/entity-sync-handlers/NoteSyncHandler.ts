import type { CreateNoteDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateNoteDataSchema, PartialNoteSchema } from '@keres/shared';
import { db } from '../../db';
import { notes } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class NoteSyncHandler extends BaseSyncEntityHandler<
  typeof CreateNoteDataSchema,
  typeof PartialNoteSchema
> {
  entityName = 'Note';

  constructor() {
    super('id', 'version', CreateNoteDataSchema, PartialNoteSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
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

  // `update` and `delete` come from the base class on purpose. There used to be an override here that
  // only repeated what the base does, but without `checkVersionConflict`, without the
  // `deleted_on_server` check and without honouring the client's `operationTime` - the result was that
  // a concurrent edit on this entity produced no conflict at all and, when the `where version = ...`
  // clause did not match, the user's edit vanished with no error and no warning.
}
