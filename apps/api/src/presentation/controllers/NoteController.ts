import type {
  BulkDeleteNoteUseCase,
  CreateNoteUseCase,
  DeleteNoteUseCase,
  GetNotesByStoryIdUseCase,
  GetNoteUseCase,
  UpdateNoteUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateNoteSchema,
  type ListQueryParams,
  NoteResponseSchema,
  type UpdateNoteSchema,
} from '@keres/shared'

export class NoteController {
  constructor(
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getNoteUseCase: GetNoteUseCase,
    private readonly updateNoteUseCase: UpdateNoteUseCase,
    private readonly deleteNoteUseCase: DeleteNoteUseCase,
    private readonly bulkDeleteNoteUseCase: BulkDeleteNoteUseCase,
    private readonly getNotesByStoryIdUseCase: GetNotesByStoryIdUseCase,
  ) {}

  async createNote(userId: string, data: z.infer<typeof CreateNoteSchema>) {
    const note = await this.createNoteUseCase.execute(userId, data)
    return NoteResponseSchema.parse(note)
  }

  async getNote(userId: string, id: string) {
    const note = await this.getNoteUseCase.execute(userId, id)
    if (!note) {
      throw new Error('Note not found')
    }
    return NoteResponseSchema.parse(note)
  }

  async getNotesByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const notes = await this.getNotesByStoryIdUseCase.execute(userId, storyId, query)
    return notes.map((note) => NoteResponseSchema.parse(note))
  }

  async updateNote(userId: string, id: string, data: Omit<z.infer<typeof UpdateNoteSchema>, 'id'>) {
    const updatedNote = await this.updateNoteUseCase.execute(userId, id, data)
    if (!updatedNote) {
      throw new Error('Note not found')
    }
    return NoteResponseSchema.parse(updatedNote)
  }

  async deleteNote(userId: string, id: string) {
    const deleted = await this.deleteNoteUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Note not found')
    }
    return
  }

  async bulkDeleteNotes(userId: string, ids: string[]) {
    const result = await this.bulkDeleteNoteUseCase.execute(userId, ids)
    return result
  }
}
