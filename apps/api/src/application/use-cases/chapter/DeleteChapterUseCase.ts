import type { IChapterRepository } from '@domain/repositories/IChapterRepository'

export class DeleteChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingChapter = await this.chapterRepository.findById(id)
    if (!existingChapter) {
      return false // Chapter not found
    }
    // Check ownership
    await this.chapterRepository.delete(id)
    return true
  }
}
