import type { ChoiceProfileDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'

export class GetChoiceUseCase {
  constructor(private choiceRepository: IChoiceRepository) {}

  async execute(id: string): Promise<ChoiceProfileDTO | null> {
    const choice = await this.choiceRepository.findById(id)
    if (!choice) {
      return null
    }
    return this.mapToProfileDTO(choice)
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
