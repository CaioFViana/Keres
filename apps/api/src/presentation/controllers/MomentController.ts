import type {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'

import { MomentCreateSchema, MomentResponseSchema, MomentUpdateSchema } from '@keres/shared'
import z from 'zod'

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase,
  ) {}

  async createMoment(data: z.infer<typeof MomentCreateSchema>) {
    const moment = await this.createMomentUseCase.execute(data)
    return MomentResponseSchema.parse(moment)
  }

  async getMoment(id: string) {
    const moment = await this.getMomentUseCase.execute(id)
    if (!moment) {
      throw new Error('Moment not found')
    }
    return MomentResponseSchema.parse(moment)
  }

  async getMomentsBySceneId(sceneId: string) {
    const moments = await this.getMomentsBySceneIdUseCase.execute(sceneId)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async updateMoment(id: string, data: z.infer<typeof MomentUpdateSchema>) {
    const updatedMoment = await this.updateMomentUseCase.execute({ id, ...data })
    if (!updatedMoment) {
      throw new Error('Moment not found or does not belong to the specified scene')
    }
    return MomentResponseSchema.parse(updatedMoment)
  }

  async deleteMoment(id: string, sceneId: string) {
    if (!sceneId) {
      throw new Error('sceneId is required for deletion')
    }
    const deleted = await this.deleteMomentUseCase.execute(id, sceneId)
    if (!deleted) {
      throw new Error('Moment not found or does not belong to the specified scene')
    }
    return
  }
}
