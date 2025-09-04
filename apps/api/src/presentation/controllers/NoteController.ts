import type {
  CreateNoteUseCase,
  DeleteNoteUseCase,
  GetNotesByStoryIdUseCase,
  GetNoteUseCase,
  UpdateNoteUseCase,
} from '@application/use-cases'
import type z from 'zod'

import { type CreateNoteSchema, NoteResponseSchema, type UpdateNoteSchema } from '@keres/shared'

export class NoteController {
  constructor(
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getNoteUseCase: GetNoteUseCase,
    private readonly updateNoteUseCase: UpdateNoteUseCase,
    private readonly deleteNoteUseCase: DeleteNoteUseCase,
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

  async getNotesByStoryId(userId: string, storyId: string) {
    const notes = await this.getNotesByStoryIdUseCase.execute(userId, storyId)
    return notes.map((note) => NoteResponseSchema.parse(note))
  }

  async updateNote(userId: string, id: string, data: z.infer<typeof UpdateNoteSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedNote = await this.updateNoteUseCase.execute(userId, { id, ...updateData })
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
}
