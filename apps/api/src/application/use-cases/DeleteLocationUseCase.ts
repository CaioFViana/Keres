import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class DeleteLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(id: string, storyId: string): Promise<boolean> {
    const existingLocation = await this.locationRepository.findById(id);
    if (!existingLocation) {
      return false; // Location not found
    }
    if (existingLocation.storyId !== storyId) { // Check ownership
      return false; // Location does not belong to this story
    }
    await this.locationRepository.delete(id);
    return true;
  }
}