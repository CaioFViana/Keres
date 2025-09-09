import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class BulkDeleteNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
  ): Promise<{ successfulIds: string[]; failedIds: { id: string; reason: string }[] }> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingNote = await this.noteRepository.findById(id)
        if (!existingNote) {
          failedIds.push({ id, reason: 'Note not found' })
          continue
        }

        const story = await this.storyRepository.findById(existingNote.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.noteRepository.delete(id, existingNote.storyId)
        successfulIds.push(id)
      } catch (error: any) {
        failedIds.push({ id, reason: error.message || 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
