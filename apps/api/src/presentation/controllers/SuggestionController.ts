import type {
  CreateSuggestionUseCase,
  DeleteSuggestionUseCase,
  GetSuggestionsByStoryAndTypeUseCase,
  GetSuggestionsByStoryIdUseCase,
  GetSuggestionsByTypeUseCase,
  GetSuggestionsByUserAndTypeUseCase,
  GetSuggestionsByUserIdUseCase,
  GetSuggestionUseCase,
  UpdateSuggestionUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateSuggestionSchema,
  SuggestionResponseSchema,
  type UpdateSuggestionSchema,
} from '@keres/shared'

export class SuggestionController {
  constructor(
    private readonly createSuggestionUseCase: CreateSuggestionUseCase,
    private readonly getSuggestionUseCase: GetSuggestionUseCase,
    private readonly updateSuggestionUseCase: UpdateSuggestionUseCase,
    private readonly deleteSuggestionUseCase: DeleteSuggestionUseCase,
    private readonly getSuggestionsByUserIdUseCase: GetSuggestionsByUserIdUseCase,
    private readonly getSuggestionsByStoryIdUseCase: GetSuggestionsByStoryIdUseCase,
    private readonly getSuggestionsByTypeUseCase: GetSuggestionsByTypeUseCase,
    private readonly getSuggestionsByUserAndTypeUseCase: GetSuggestionsByUserAndTypeUseCase,
    private readonly getSuggestionsByStoryAndTypeUseCase: GetSuggestionsByStoryAndTypeUseCase,
  ) {}

  async createSuggestion(data: z.infer<typeof CreateSuggestionSchema>) {
    const suggestion = await this.createSuggestionUseCase.execute(data)
    return SuggestionResponseSchema.parse(suggestion)
  }

  async getSuggestion(id: string) {
    const suggestion = await this.getSuggestionUseCase.execute(id)
    if (!suggestion) {
      throw new Error('Suggestion not found')
    }
    return SuggestionResponseSchema.parse(suggestion)
  }

  async getSuggestionsByUserId(userId: string) {
    const suggestions = await this.getSuggestionsByUserIdUseCase.execute(userId)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async getSuggestionsByStoryId(storyId: string) {
    const suggestions = await this.getSuggestionsByStoryIdUseCase.execute(storyId)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async getSuggestionsByType(type: string) {
    const suggestions = await this.getSuggestionsByTypeUseCase.execute(type)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async getSuggestionsByUserAndType(userId: string, type: string) {
    const suggestions = await this.getSuggestionsByUserAndTypeUseCase.execute(userId, type)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async getSuggestionsByStoryAndType(storyId: string, type: string) {
    const suggestions = await this.getSuggestionsByStoryAndTypeUseCase.execute(storyId, type)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async updateSuggestion(id: string, data: z.infer<typeof UpdateSuggestionSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedSuggestion = await this.updateSuggestionUseCase.execute({ id, ...updateData })
    if (!updatedSuggestion) {
      throw new Error('Suggestion not found')
    }
    return SuggestionResponseSchema.parse(updatedSuggestion)
  }

  async deleteSuggestion(id: string) {
    const deleted = await this.deleteSuggestionUseCase.execute(id)
    if (!deleted) {
      throw new Error('Suggestion not found')
    }
    return
  }
}
