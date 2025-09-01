import type { ITagRepository } from '@domain/repositories/ITagRepository'

export class DeleteTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingTag = await this.tagRepository.findById(id)
    if (!existingTag) {
      return false // Tag not found
    }
    await this.tagRepository.delete(id)
    return true
  }
}
