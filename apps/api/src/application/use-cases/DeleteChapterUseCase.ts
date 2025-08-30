import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class DeleteChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(chapterId: string, storyId: string): Promise<boolean> {
    const existingChapter = await this.chapterRepository.findById(chapterId);
    if (!existingChapter || existingChapter.storyId !== storyId) {
      // Chapter not found or does not belong to the specified story
      return false;
    }

    await this.chapterRepository.delete(chapterId);
    return true;
  }
}
