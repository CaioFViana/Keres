import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagAssignmentPayload } from 'schemas'

export class AddTagToEntityUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly locationRepository: ILocationRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, data: TagAssignmentPayload): Promise<void> {
    const { tagId, targetType, targetId } = data

    // 1. Validate tag existence
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new Error('Tag not found.')
    }

    // 2. Validate target entity existence and ownership
    switch (targetType) {
      case 'Character': {
        const character = await this.characterRepository.findById(targetId)
        if (!character) {
          throw new Error('Character not found.')
        }
        const characterStory = await this.storyRepository.findById(character.storyId, userId)
        if (!characterStory) {
          throw new Error('Character not owned by user.')
        }
        await this.tagRepository.addTagToCharacter(targetId, tagId)
        break
      }
      case 'Location': {
        const location = await this.locationRepository.findById(targetId)
        if (!location) {
          throw new Error('Location not found.')
        }
        const locationStory = await this.storyRepository.findById(location.storyId, userId)
        if (!locationStory) {
          throw new Error('Location not owned by user.')
        }
        await this.tagRepository.addTagToLocation(targetId, tagId)
        break
      }
      case 'Chapter': {
        const chapter = await this.chapterRepository.findById(targetId)
        if (!chapter) {
          throw new Error('Chapter not found.')
        }
        const chapterStory = await this.storyRepository.findById(chapter.storyId, userId)
        if (!chapterStory) {
          throw new Error('Chapter not owned by user.')
        }
        await this.tagRepository.addTagToChapter(targetId, tagId)
        break
      }
      case 'Scene': {
        const scene = await this.sceneRepository.findById(targetId)
        if (!scene) {
          throw new Error('Scene not found.')
        }
        const chapterCheck = await this.chapterRepository.findById(scene.chapterId)
        if (!chapterCheck) {
          throw new Error('Chapter for scene not found.') // Should not happen if DB is consistent
        }
        const chapterStoryCheck = await this.storyRepository.findById(chapterCheck.storyId, userId)
        if (!chapterStoryCheck) {
          throw new Error('Scene not owned by user.')
        }
        await this.tagRepository.addTagToScene(targetId, tagId)
        break
      }
      default:
        throw new Error('Invalid target type.')
    }
  }
}
