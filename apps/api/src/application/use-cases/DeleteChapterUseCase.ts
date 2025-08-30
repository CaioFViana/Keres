import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class DeleteChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(id: string, storyId: string): Promise<boolean> {
    const existingChapter = await this.chapterRepository.findById(id);
    if (!existingChapter) {
      return false; // Chapter not found
    }
    if (existingChapter.storyId !== storyId) { // Check ownership
      return false; // Chapter does not belong to this story
    }
    await this.chapterRepository.delete(id);
    return true;
  }
}