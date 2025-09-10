import type {
  BulkDeleteWorldRuleUseCase,
  CreateWorldRuleUseCase,
  DeleteWorldRuleUseCase,
  GetWorldRulesByStoryIdUseCase,
  GetWorldRuleUseCase,
  UpdateWorldRuleUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateWorldRuleSchema,
  type ListQueryParams,
  type UpdateWorldRuleSchema,
  WorldRuleResponseSchema,
} from '@keres/shared'

export class WorldRuleController {
  constructor(
    private readonly createWorldRuleUseCase: CreateWorldRuleUseCase,
    private readonly getWorldRuleUseCase: GetWorldRuleUseCase,
    private readonly updateWorldRuleUseCase: UpdateWorldRuleUseCase,
    private readonly deleteWorldRuleUseCase: DeleteWorldRuleUseCase,
    private readonly bulkDeleteWorldRuleUseCase: BulkDeleteWorldRuleUseCase,
    private readonly getWorldRulesByStoryIdUseCase: GetWorldRulesByStoryIdUseCase,
  ) {}

  async createWorldRule(userId: string, data: z.infer<typeof CreateWorldRuleSchema>) {
    const worldRule = await this.createWorldRuleUseCase.execute(userId, data)
    return WorldRuleResponseSchema.parse(worldRule)
  }

  async getWorldRule(userId: string, id: string) {
    const worldRule = await this.getWorldRuleUseCase.execute(userId, id)
    if (!worldRule) {
      throw new Error('World Rule not found')
    }
    return WorldRuleResponseSchema.parse(worldRule)
  }

  async getWorldRulesByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const worldRules = await this.getWorldRulesByStoryIdUseCase.execute(userId, storyId, query)
    return worldRules.map((worldRule) => WorldRuleResponseSchema.parse(worldRule))
  }

  async updateWorldRule(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof UpdateWorldRuleSchema>, 'id'>,
  ) {
    const updatedWorldRule = await this.updateWorldRuleUseCase.execute(userId, id, data)
    if (!updatedWorldRule) {
      throw new Error('World Rule not found')
    }
    return WorldRuleResponseSchema.parse(updatedWorldRule)
  }

  async deleteWorldRule(userId: string, id: string) {
    const deleted = await this.deleteWorldRuleUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('World Rule not found')
    }
    return
  }

  async bulkDeleteWorldRules(userId: string, ids: string[]) {
    const result = await this.bulkDeleteWorldRuleUseCase.execute(userId, ids)
    return result
  }
}
