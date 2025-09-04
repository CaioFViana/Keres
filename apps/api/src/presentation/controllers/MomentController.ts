import type {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateMomentSchema, // Renamed
  MomentResponseSchema,
  type UpdateMomentSchema, // Renamed
} from '@keres/shared'

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase,
  ) {}

  async createMoment(userId: string, data: z.infer<typeof CreateMomentSchema>) {
    const moment = await this.createMomentUseCase.execute(userId, data)
    return MomentResponseSchema.parse(moment)
  }

  async getMoment(userId: string, id: string) {
    const moment = await this.getMomentUseCase.execute(userId, id)
    if (!moment) {
      throw new Error('Moment not found')
    }
    return MomentResponseSchema.parse(moment)
  }

  async getMomentsBySceneId(userId: string, sceneId: string) {
    const moments = await this.getMomentsBySceneIdUseCase.execute(userId, sceneId)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async updateMoment(userId: string, id: string, data: z.infer<typeof UpdateMomentSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedMoment = await this.updateMomentUseCase.execute(userId, { id, ...updateData })
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
}
