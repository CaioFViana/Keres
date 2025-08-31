import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ChoiceProfileDTO, UpdateChoiceDTO } from '@application/dtos/ChoiceDTOs'

export class UpdateChoiceUseCase {
  constructor(private choiceRepository: IChoiceRepository) {}

  async execute(id: string, data: UpdateChoiceDTO): Promise<ChoiceProfileDTO | null> {
    const updatedChoice = await this.choiceRepository.update(id, data)
    if (!updatedChoice) {
      return null
    }
    return this.mapToProfileDTO(updatedChoice)
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
