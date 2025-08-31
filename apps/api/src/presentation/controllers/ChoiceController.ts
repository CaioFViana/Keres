import type {
  ChoiceProfileDTO,
  CreateChoiceDTO,
  UpdateChoiceDTO,
} from '@application/dtos/ChoiceDTOs'
import type { CreateChoiceUseCase } from '@application/use-cases/CreateChoiceUseCase'
import type { DeleteChoiceUseCase } from '@application/use-cases/DeleteChoiceUseCase'
import type { GetChoicesBySceneIdUseCase } from '@application/use-cases/GetChoicesBySceneIdUseCase'
import type { GetChoiceUseCase } from '@application/use-cases/GetChoiceUseCase'
import type { UpdateChoiceUseCase } from '@application/use-cases/UpdateChoiceUseCase'

export class ChoiceController {
  constructor(
    private createChoiceUseCase: CreateChoiceUseCase,
    private getChoiceUseCase: GetChoiceUseCase,
    private updateChoiceUseCase: UpdateChoiceUseCase,
    private deleteChoiceUseCase: DeleteChoiceUseCase,
    private getChoicesBySceneIdUseCase: GetChoicesBySceneIdUseCase,
  ) {}

  async createChoice(data: CreateChoiceDTO): Promise<ChoiceProfileDTO> {
    return this.createChoiceUseCase.execute(data)
  }

  async getChoice(id: string): Promise<ChoiceProfileDTO | null> {
    return this.getChoiceUseCase.execute(id)
  }

  async updateChoice(id: string, data: UpdateChoiceDTO): Promise<ChoiceProfileDTO | null> {
    return this.updateChoiceUseCase.execute(id, data)
  }

  async deleteChoice(id: string): Promise<void> {
    await this.deleteChoiceUseCase.execute(id)
  }

  async getChoicesBySceneId(sceneId: string): Promise<ChoiceProfileDTO[]> {
    return this.getChoicesBySceneIdUseCase.execute(sceneId)
  }
}
