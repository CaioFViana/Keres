import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

export class DeleteLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingLocation = await this.locationRepository.findById(id)
    if (!existingLocation) {
      return false // Location not found
    }
    // Check ownership
    await this.locationRepository.delete(id)
    return true
  }
}
