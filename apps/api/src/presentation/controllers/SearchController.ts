import type { GlobalSearchUseCase } from '@application/use-cases/search/GlobalSearchUseCase'
import type { SearchQuerySchema } from '@keres/shared'
import type { z } from 'zod'

export class SearchController {
  constructor(private readonly globalSearchUseCase: GlobalSearchUseCase) {}

  async globalSearch(
    query: z.infer<typeof SearchQuerySchema>['query'],
    scope: z.infer<typeof SearchQuerySchema>['scope'],
    userId: string,
  ) {
    const results = await this.globalSearchUseCase.execute(query, scope, userId)
    return results
  }
}
