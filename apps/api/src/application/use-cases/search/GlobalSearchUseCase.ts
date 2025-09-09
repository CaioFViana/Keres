import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'

export class GlobalSearchUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly noteRepository: INoteRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly worldRuleRepository: IWorldRuleRepository,
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

    return results
  }
}
