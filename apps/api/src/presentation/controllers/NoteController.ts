import type {
  CreateNoteUseCase,
  DeleteNoteUseCase,
  GetNotesByStoryIdUseCase,
  GetNoteUseCase,
  UpdateNoteUseCase,
} from '@application/use-cases';
import type z from 'zod';

import {
  type CreateNoteSchema,
  NoteResponseSchema,
  type UpdateNoteSchema,
} from '@keres/shared';

export class NoteController {
  constructor(
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getNoteUseCase: GetNoteUseCase,
    private readonly updateNoteUseCase: UpdateNoteUseCase,
    private readonly deleteNoteUseCase: DeleteNoteUseCase,
    private readonly getNotesByStoryIdUseCase: GetNotesByStoryIdUseCase,
  ) {}

  async createNote(data: z.infer<typeof CreateNoteSchema>) {
    const note = await this.createNoteUseCase.execute(data);
    return NoteResponseSchema.parse(note);
  }

  async getNote(id: string) {
    const note = await this.getNoteUseCase.execute(id);
    if (!note) {
      throw new Error('Note not found');
    }
    return NoteResponseSchema.parse(note);
  }

  async getNotesByStoryId(storyId: string) {
    const notes = await this.getNotesByStoryIdUseCase.execute(storyId);
    return notes.map((note) => NoteResponseSchema.parse(note));
  }

  async updateNote(id: string, data: z.infer<typeof UpdateNoteSchema>) {
    const { id: dataId, ...updateData } = data;
    const updatedNote = await this.updateNoteUseCase.execute({ id, ...updateData });
    if (!updatedNote) {
      throw new Error('Note not found');
    }
    return NoteResponseSchema.parse(updatedNote);
  }

  async deleteNote(id: string) {
    const deleted = await this.deleteNoteUseCase.execute(id);
    if (!deleted) {
      throw new Error('Note not found');
    }
    return;
  }
}