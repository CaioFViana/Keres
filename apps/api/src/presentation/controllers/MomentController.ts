import type {
  BulkDeleteMomentUseCase,
  CreateManyMomentsUseCase,
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateManyMomentsUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateMomentSchema,
  type ListQueryParams,
  MomentResponseSchema,
  type UpdateMomentSchema,
} from '@keres/shared'

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase,
    private readonly bulkDeleteMomentUseCase: BulkDeleteMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase,
    private readonly createManyMomentsUseCase: CreateManyMomentsUseCase,
    private readonly updateManyMomentsUseCase: UpdateManyMomentsUseCase,
  ) {}

  async createMoment(userId: string, data: z.infer<typeof CreateMomentSchema>) {
    const moment = await this.createMomentUseCase.execute(userId, data)
    return MomentResponseSchema.parse(moment)
  }

  async createManyMoments(userId: string, data: z.infer<typeof CreateMomentSchema>[]) {
    const moments = await this.createManyMomentsUseCase.execute(userId, data)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async updateManyMoments(userId: string, data: z.infer<typeof UpdateMomentSchema>[]) {
    const moments = await this.updateManyMomentsUseCase.execute(userId, data)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async getMoment(userId: string, id: string) {
    const moment = await this.getMomentUseCase.execute(userId, id)
    if (!moment) {
      throw new Error('Moment not found')
    }
    return MomentResponseSchema.parse(moment)
  }

  async getMomentsBySceneId(userId: string, sceneId: string, query: ListQueryParams) {
    const moments = await this.getMomentsBySceneIdUseCase.execute(userId, sceneId, query)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async updateMoment(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof UpdateMomentSchema>, 'id'>,
  ) {
    const updatedMoment = await this.updateMomentUseCase.execute(userId, id, data)
    if (!updatedMoment) {
      throw new Error('Moment not found') // Simplified error message
    }
    return MomentResponseSchema.parse(updatedMoment)
  }

  async deleteMoment(userId: string, id: string) {
    const deleted = await this.deleteMomentUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Moment not found') // Simplified error message
    }
    return
  }

  async bulkDeleteMoments(userId: string, ids: string[]) {
    const result = await this.bulkDeleteMomentUseCase.execute(userId, ids)
    return result
  }
}
