import type {
  CreateWorldRuleUseCase,
  DeleteWorldRuleUseCase,
  GetWorldRulesByStoryIdUseCase,
  GetWorldRuleUseCase,
  UpdateWorldRuleUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateWorldRuleSchema,
  type UpdateWorldRuleSchema,
  WorldRuleResponseSchema,
} from '@keres/shared'

export class WorldRuleController {
  constructor(
    private readonly createWorldRuleUseCase: CreateWorldRuleUseCase,
    private readonly getWorldRuleUseCase: GetWorldRuleUseCase,
    private readonly updateWorldRuleUseCase: UpdateWorldRuleUseCase,
    private readonly deleteWorldRuleUseCase: DeleteWorldRuleUseCase,
    private readonly getWorldRulesByStoryIdUseCase: GetWorldRulesByStoryIdUseCase,
  ) {}

  async createWorldRule(data: z.infer<typeof CreateWorldRuleSchema>) {
    const worldRule = await this.createWorldRuleUseCase.execute(data)
    return WorldRuleResponseSchema.parse(worldRule)
  }

  async getWorldRule(id: string) {
    const worldRule = await this.getWorldRuleUseCase.execute(id)
    if (!worldRule) {
      throw new Error('World Rule not found')
    }
    return WorldRuleResponseSchema.parse(worldRule)
  }

  async getWorldRulesByStoryId(storyId: string) {
    const worldRules = await this.getWorldRulesByStoryIdUseCase.execute(storyId)
    return worldRules.map((worldRule) => WorldRuleResponseSchema.parse(worldRule))
  }

  async updateWorldRule(id: string, data: z.infer<typeof UpdateWorldRuleSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedWorldRule = await this.updateWorldRuleUseCase.execute({ id, ...updateData })
    if (!updatedWorldRule) {
      throw new Error('World Rule not found')
    }
    return WorldRuleResponseSchema.parse(updatedWorldRule)
  }

  async deleteWorldRule(id: string) {
    const deleted = await this.deleteWorldRuleUseCase.execute(id)
    if (!deleted) {
      throw new Error('World Rule not found')
    }
    return
  }
}
