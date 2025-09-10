import type {
  IChapterRepository,
  ICharacterRepository,
  ILocationRepository,
  IStoryRepository,
} from '@domain/repositories'

import {
  ChapterResponseSchema,
  CharacterResponseSchema,
  LocationResponseSchema,
  type StoryResponse,
} from '@keres/shared'

export class GetStoryUseCase {
  constructor(
    private readonly storyRepository: IStoryRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly locationRepository: ILocationRepository,
  ) {}

  async execute(userId: string, id: string, include: string[] = []): Promise<StoryResponse | null> {
    const story = await this.storyRepository.findById(id, userId)
    if (!story || story.userId !== userId) {
      return null
    }

    const response: StoryResponse = {
      id: story.id,
      userId: story.userId,
      title: story.title,
      type: story.type,
      summary: story.summary,
      genre: story.genre,
      language: story.language,
      isFavorite: story.isFavorite,
      extraNotes: story.extraNotes,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }

    if (include.includes('characters')) {
      const rawCharacters = await this.characterRepository.findByStoryId(story.id)
      response.characters = rawCharacters.map((c) => CharacterResponseSchema.parse(c))
    }

    if (include.includes('chapters')) {
      const rawChapters = await this.chapterRepository.findByStoryId(story.id)
      response.chapters = rawChapters.map((c) => ChapterResponseSchema.parse(c))
    }

    if (include.includes('locations')) {
      const rawLocations = await this.locationRepository.findByStoryId(story.id)
      response.locations = rawLocations.map((c) => LocationResponseSchema.parse(c))
    }
    return response
  }
}
