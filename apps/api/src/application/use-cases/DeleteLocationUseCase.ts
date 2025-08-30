import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class DeleteLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(locationId: string, storyId: string): Promise<boolean> {
    const existingLocation = await this.locationRepository.findById(locationId);
    if (!existingLocation || existingLocation.storyId !== storyId) {
      // Location not found or does not belong to the specified story
      return false;
    }

    await this.locationRepository.delete(locationId);
    return true;
  }
}
