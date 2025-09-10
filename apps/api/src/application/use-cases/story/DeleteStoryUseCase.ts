import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'

export class DeleteStoryUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly choiceRepository: IChoiceRepository,
    private readonly momentRepository: IMomentRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly locationRepository: ILocationRepository,
    private readonly galleryRepository: IGalleryRepository,
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly noteRepository: INoteRepository,
    private readonly tagRepository: ITagRepository,
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRelationRepository: ICharacterRelationRepository,
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingStory = await this.storyRepository.findById(id, userId)
    if (!existingStory || existingStory.userId !== userId) {
      return false // Story not found or does not belong to this user
    }
    // Delete associated entities in correct order to respect foreign key constraints

    // 1. Delete join tables (many-to-many relationships)
    const allCharactersInStory = await this.characterRepository.findByStoryId(id)
    for (const character of allCharactersInStory.items) {
      await this.characterMomentRepository.deleteByCharacterId(character.id)
      await this.characterRelationRepository.deleteByCharacterId(character.id)
      await this.tagRepository.deleteCharacterTagsByCharacterId(character.id)
    }

    const allLocationsInStory = await this.locationRepository.findByStoryId(id)
    for (const location of allLocationsInStory.items) {
      await this.tagRepository.deleteLocationTagsByLocationId(location.id)
    }

    const allChaptersInStory = await this.chapterRepository.findByStoryId(id)
    for (const chapter of allChaptersInStory.items) {
      await this.tagRepository.deleteChapterTagsByChapterId(chapter.id)
    }

    const allScenesInStory = await this.sceneRepository.findByStoryId(id) // Assuming findByStoryId exists or needs to be implemented
    for (const scene of allScenesInStory.items) {
      await this.tagRepository.deleteSceneTagsBySceneId(scene.id)
    }

    // 2. Delete entities dependent on Scene (Choices, Moments)
    for (const scene of allScenesInStory.items) {
      const choicesInScene = await this.choiceRepository.findBySceneId(scene.id)
      for (const choice of choicesInScene) {
        await this.choiceRepository.delete(choice.id, scene.id)
      }
      const momentsInScene = await this.momentRepository.findBySceneId(scene.id)
      for (const moment of momentsInScene.items) {
        await this.momentRepository.delete(moment.id, scene.id)
      }
    }

    // 3. Delete Scenes
    for (const scene of allScenesInStory.items) {
      await this.sceneRepository.delete(scene.id, scene.chapterId)
    }

    // 4. Delete entities dependent on Story (Chapters, Characters, Locations, Gallery, WorldRules, Notes, Tags, Suggestions)
    for (const chapter of allChaptersInStory.items) {
      await this.chapterRepository.delete(chapter.id, chapter.storyId)
    }
    for (const character of allCharactersInStory.items) {
      await this.characterRepository.delete(character.id, character.storyId)
    }
    for (const location of allLocationsInStory.items) {
      await this.locationRepository.delete(location.id, location.storyId)
    }
    const galleryItemsInStory = await this.galleryRepository.findByStoryId(id)
    for (const item of galleryItemsInStory.items) {
      await this.galleryRepository.delete(item.id, item.storyId, item.ownerId)
    }
    const worldRulesInStory = await this.worldRuleRepository.findByStoryId(id)
    for (const rule of worldRulesInStory.items) {
      await this.worldRuleRepository.delete(rule.id, rule.storyId)
    }
    const notesInStory = await this.noteRepository.findByStoryId(id)
    for (const note of notesInStory.items) {
      await this.noteRepository.delete(note.id, note.storyId)
    }
    const tagsInStory = await this.tagRepository.findByStoryId(id)
    for (const tag of tagsInStory.items) {
      await this.tagRepository.delete(tag.id, tag.storyId)
    }
    const suggestionsInStory = await this.suggestionRepository.findByStoryId(id)
    for (const suggestion of suggestionsInStory.items) {
      await this.suggestionRepository.delete(suggestion.id, suggestion.userId, suggestion.scope, suggestion.storyId)
    }

    // 5. Finally, delete the Story itself
    await this.storyRepository.delete(id, userId)
    return true
  }
}

