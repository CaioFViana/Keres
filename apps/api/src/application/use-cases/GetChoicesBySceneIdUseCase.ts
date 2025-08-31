import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ChoiceProfileDTO } from '@application/dtos/ChoiceDTOs'

export class GetChoicesBySceneIdUseCase {
  constructor(private choiceRepository: IChoiceRepository) {}

  async execute(sceneId: string): Promise<ChoiceProfileDTO[]> {
    const choices = await this.choiceRepository.findBySceneId(sceneId)
    return choices.map(this.mapToProfileDTO)
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
