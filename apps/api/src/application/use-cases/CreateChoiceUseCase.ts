import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ChoiceProfileDTO, CreateChoiceDTO } from '@application/dtos/ChoiceDTOs'

export class CreateChoiceUseCase {
  constructor(private choiceRepository: IChoiceRepository) {}

  async execute(data: CreateChoiceDTO): Promise<ChoiceProfileDTO> {
    const newChoice = await this.choiceRepository.create(data)
    return this.mapToProfileDTO(newChoice)
  }

  private mapToProfileDTO(choice: Choice): ChoiceProfileDTO {
    return {
      id: choice.id,
      sceneId: choice.sceneId,
      nextSceneId: choice.nextSceneId,
      text: choice.text,
      isImplicit: choice.isImplicit,
      createdAt: choice.createdAt,
      updatedAt: choice.updatedAt,
    }
  }
}
