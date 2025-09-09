import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import { ListQueryParams, StoryResponseSchema, CharacterResponseSchema, ChapterResponseSchema, LocationResponseSchema } from '@keres/shared'
import type { z } from 'zod'

export class GetStoriesByUserIdUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly locationRepository: ILocationRepository,
  ) {}

  async execute(userId: string, query: ListQueryParams, include: string[] = []): Promise<z.infer<typeof StoryResponseSchema>[]> {
    const stories = await this.storyRepository.findByUserId(userId, query)

    const storiesWithIncludes = await Promise.all(stories.map(async (story) => {
      const storyResponse = StoryResponseSchema.parse(story)

      if (include.includes('characters')) {
        const rawCharacters = await this.characterRepository.findByStoryId(story.id)
        storyResponse.characters = rawCharacters.map(c => CharacterResponseSchema.parse(c))
      }

      if (include.includes('chapters')) {
        const rawChapters = await this.chapterRepository.findByStoryId(story.id)
        storyResponse.chapters = rawChapters.map(ch => ChapterResponseSchema.parse(ch))
      }

      if (include.includes('locations')) {
        const rawLocations = await this.locationRepository.findByStoryId(story.id)
        storyResponse.locations = rawLocations.map(l => LocationResponseSchema.parse(l))
      }

      return storyResponse
    }))

    return storiesWithIncludes
  }
}
