import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'

export class GlobalSearchUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly noteRepository: INoteRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly locationRepository: ILocationRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly choiceRepository: IChoiceRepository,
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly suggestionRepository: ISuggestionRepository,
  ) {}

  async execute(query: string, scope: string[], userId: string) {
    const results: any[] = []

    if (scope.includes('stories')) {
      const stories = await this.storyRepository.search(query, userId)
      results.push(...stories.map(story => ({ type: 'story', data: story })))
    }

    if (scope.includes('notes')) {
      const notes = await this.noteRepository.search(query, userId)
      results.push(...notes.map(note => ({ type: 'note', data: note })))
    }

    if (scope.includes('characters')) {
      const characters = await this.characterRepository.search(query, userId)
      results.push(...characters.map(character => ({ type: 'character', data: character })))
    }

    if (scope.includes('world_rules')) {
      const worldRules = await this.worldRuleRepository.search(query, userId)
      results.push(...worldRules.map(worldRule => ({ type: 'world_rule', data: worldRule })))
    }

    if (scope.includes('locations')) {
      const locations = await this.locationRepository.search(query, userId)
      results.push(...locations.map(location => ({ type: 'location', data: location })))
    }

    if (scope.includes('chapters')) {
      const chapters = await this.chapterRepository.search(query, userId)
      results.push(...chapters.map(chapter => ({ type: 'chapter', data: chapter })))
    }

    if (scope.includes('choices')) {
      const choices = await this.choiceRepository.search(query, userId)
      results.push(...choices.map(choice => ({ type: 'choice', data: choice })))
    }

    if (scope.includes('moments')) {
      const moments = await this.momentRepository.search(query, userId)
      results.push(...moments.map(moment => ({ type: 'moment', data: moment })))
    }

    if (scope.includes('scenes')) {
      const scenes = await this.sceneRepository.search(query, userId)
      results.push(...scenes.map(scene => ({ type: 'scene', data: scene })))
    }

    if (scope.includes('suggestions')) {
      const suggestions = await this.suggestionRepository.search(query, userId)
      results.push(...suggestions.map(suggestion => ({ type: 'suggestion', data: suggestion })))
    }

    return results
  }
}
