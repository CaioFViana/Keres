import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { z } from 'zod'

import {
  ChapterResponseSchema,
  CharacterResponseSchema,
  type ListQueryParams,
  LocationResponseSchema,
  StoryResponseSchema,
  type PaginatedResponse,
} from '@keres/shared'

export class GetStoriesByUserIdUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly locationRepository: ILocationRepository,
  ) {}

  async execute(
    userId: string,
    query: ListQueryParams,
    include: string[] = [],
  ): Promise<PaginatedResponse<z.infer<typeof StoryResponseSchema>>> {
    const paginatedStories = await this.storyRepository.findByUserId(userId, query)

    const items = await Promise.all(
      paginatedStories.items.map(async (story) => {
        const storyResponse = StoryResponseSchema.parse(story)
        if (include.includes('characters')) {
          const paginatedCharacters = await this.characterRepository.findByStoryId(story.id, query)
          storyResponse.characters = paginatedCharacters.items.map((c) => CharacterResponseSchema.parse(c))
        }

        if (include.includes('chapters')) {
          const paginatedChapters = await this.chapterRepository.findByStoryId(story.id, query)
          storyResponse.chapters = paginatedChapters.items.map((ch) => ChapterResponseSchema.parse(ch))
        }

        if (include.includes('locations')) {
          const paginatedLocations = await this.locationRepository.findByStoryId(story.id, query)
          console.log(paginatedLocations)
          storyResponse.locations = paginatedLocations.items.map((l) => LocationResponseSchema.parse(l))
        }

        return storyResponse
      }),
    )

    return {
      items,
      totalItems: paginatedStories.totalItems,
    }
  }
}
