import type { INoteRepository } from '@domain/repositories/INoteRepository'

export class DeleteNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingNote = await this.noteRepository.findById(id)
    if (!existingNote) {
      return false // Note not found
    }
    await this.noteRepository.delete(id)
    return true
  }
}
