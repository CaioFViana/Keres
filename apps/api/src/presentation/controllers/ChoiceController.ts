import type {
  ChoiceProfileDTO,
  CreateChoiceDTO,
  UpdateChoiceDTO,
} from '@application/dtos/ChoiceDTOs'
import type { CreateChoiceUseCase } from '@application/use-cases/'
import type { DeleteChoiceUseCase } from '@application/use-cases/'
import type { GetChoicesBySceneIdUseCase } from '@application/use-cases/'
import type { GetChoiceUseCase } from '@application/use-cases/'
import type { UpdateChoiceUseCase } from '@application/use-cases/'

export class ChoiceController {
  constructor(
    private createChoiceUseCase: CreateChoiceUseCase,
    private getChoiceUseCase: GetChoiceUseCase,
    private updateChoiceUseCase: UpdateChoiceUseCase,
    private deleteChoiceUseCase: DeleteChoiceUseCase,
    private getChoicesBySceneIdUseCase: GetChoicesBySceneIdUseCase,
  ) {}

  async createChoice(userId: string, data: CreateChoiceDTO): Promise<ChoiceProfileDTO> {
    return this.createChoiceUseCase.execute(userId, data)
  }

  async getChoice(userId: string, id: string): Promise<ChoiceProfileDTO | null> {
    return this.getChoiceUseCase.execute(userId, id)
  }

  async updateChoice(userId: string, id: string, data: UpdateChoiceDTO): Promise<ChoiceProfileDTO | null> {
    return this.updateChoiceUseCase.execute(userId, id, data)
  }

  async deleteChoice(userId: string, id: string): Promise<void> {
    await this.deleteChoiceUseCase.execute(userId, id)
  }

  async getChoicesBySceneId(userId: string, sceneId: string): Promise<ChoiceProfileDTO[]> {
    return this.getChoicesBySceneIdUseCase.execute(userId, sceneId)
  }
}
