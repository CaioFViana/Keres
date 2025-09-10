import type {
  BulkDeleteSuggestionUseCase,
  CreateManySuggestionsUseCase,
  CreateSuggestionUseCase,
  DeleteSuggestionUseCase,
  GetSuggestionsByStoryAndTypeUseCase,
  GetSuggestionsByStoryIdUseCase,
  GetSuggestionsByTypeUseCase,
  GetSuggestionsByUserAndTypeUseCase,
  GetSuggestionsByUserIdUseCase,
  GetSuggestionUseCase,
  UpdateManySuggestionsUseCase,
  UpdateSuggestionUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateSuggestionSchema,
  type ListQueryParams,
  SuggestionResponseSchema,
  type UpdateSuggestionSchema,
  type PaginatedResponse,
} from '@keres/shared'

export class SuggestionController {
  constructor(
    private readonly createSuggestionUseCase: CreateSuggestionUseCase,
    private readonly getSuggestionUseCase: GetSuggestionUseCase,
    private readonly updateSuggestionUseCase: UpdateSuggestionUseCase,
    private readonly deleteSuggestionUseCase: DeleteSuggestionUseCase,
    private readonly bulkDeleteSuggestionUseCase: BulkDeleteSuggestionUseCase,
    private readonly getSuggestionsByUserIdUseCase: GetSuggestionsByUserIdUseCase,
    private readonly getSuggestionsByStoryIdUseCase: GetSuggestionsByStoryIdUseCase,
    private readonly getSuggestionsByTypeUseCase: GetSuggestionsByTypeUseCase,
    private readonly getSuggestionsByUserAndTypeUseCase: GetSuggestionsByUserAndTypeUseCase,
    private readonly getSuggestionsByStoryAndTypeUseCase: GetSuggestionsByStoryAndTypeUseCase,
    private readonly createManySuggestionsUseCase: CreateManySuggestionsUseCase,
    private readonly updateManySuggestionsUseCase: UpdateManySuggestionsUseCase,
  ) {}

  async createSuggestion(userId: string, data: z.infer<typeof CreateSuggestionSchema>) {
    const suggestion = await this.createSuggestionUseCase.execute(userId, data)
    return SuggestionResponseSchema.parse(suggestion)
  }

  async createManySuggestions(userId: string, data: z.infer<typeof CreateSuggestionSchema>[]) {
    const suggestions = await this.createManySuggestionsUseCase.execute(userId, data)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async updateManySuggestions(userId: string, data: z.infer<typeof UpdateSuggestionSchema>[]) {
    const suggestions = await this.updateManySuggestionsUseCase.execute(userId, data)
    return suggestions.map((suggestion) => SuggestionResponseSchema.parse(suggestion))
  }

  async getSuggestion(userId: string, id: string) {
    const suggestion = await this.getSuggestionUseCase.execute(userId, id)
    if (!suggestion) {
      throw new Error('Suggestion not found')
    }
    return SuggestionResponseSchema.parse(suggestion)
  }

  async getSuggestionsByUserId(
    userId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof SuggestionResponseSchema>>> {
    const paginatedSuggestions = await this.getSuggestionsByUserIdUseCase.execute(userId, query)
    const items = paginatedSuggestions.items.map((suggestion) => SuggestionResponseSchema.parse(suggestion))

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }

  async getSuggestionsByStoryId(
    userId: string,
    storyId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof SuggestionResponseSchema>>> {
    const paginatedSuggestions = await this.getSuggestionsByStoryIdUseCase.execute(userId, storyId, query)
    const items = paginatedSuggestions.items.map((suggestion) => SuggestionResponseSchema.parse(suggestion))

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }

  async getSuggestionsByType(
    userId: string,
    type: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof SuggestionResponseSchema>>> {
    const paginatedSuggestions = await this.getSuggestionsByTypeUseCase.execute(userId, type, query)
    const items = paginatedSuggestions.items.map((suggestion) => SuggestionResponseSchema.parse(suggestion))

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }

  async getSuggestionsByUserAndType(
    userId: string,
    type: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof SuggestionResponseSchema>>> {
    const paginatedSuggestions = await this.getSuggestionsByUserAndTypeUseCase.execute(userId, type, query)
    const items = paginatedSuggestions.items.map((suggestion) => SuggestionResponseSchema.parse(suggestion))

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }

  async getSuggestionsByStoryAndType(
    userId: string,
    storyId: string,
    type: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof SuggestionResponseSchema>>> {
    const paginatedSuggestions = await this.getSuggestionsByStoryAndTypeUseCase.execute(
      userId,
      storyId,
      type,
      query,
    )
    const items = paginatedSuggestions.items.map((suggestion) => SuggestionResponseSchema.parse(suggestion))

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }

  async updateSuggestion(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof UpdateSuggestionSchema>, 'id'>,
  ) {
    const updatedSuggestion = await this.updateSuggestionUseCase.execute(userId, id, data)
    if (!updatedSuggestion) {
      throw new Error('Suggestion not found')
    }
    return SuggestionResponseSchema.parse(updatedSuggestion)
  }

  async deleteSuggestion(userId: string, id: string) {
    const deleted = await this.deleteSuggestionUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Suggestion not found')
    }
    return
  }

  async bulkDeleteSuggestions(userId: string, ids: string[]) {
    const result = await this.bulkDeleteSuggestionUseCase.execute(userId, ids)
    return result
  }
}
