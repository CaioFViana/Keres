import type {
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
} from '@application/use-cases'

import { LocationCreateSchema, LocationResponseSchema, LocationUpdateSchema } from '@keres/shared'
import z from 'zod'

export class LocationController {
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
    private readonly getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase,
  ) {}

  async createLocation(data: z.infer<typeof LocationCreateSchema>) {
    const location = await this.createLocationUseCase.execute(data)
    return LocationResponseSchema.parse(location)
  }

  async getLocation(id: string) {
    const location = await this.getLocationUseCase.execute(id)
    if (!location) {
      throw new Error('Location not found')
    }
    return LocationResponseSchema.parse(location)
  }

  async getLocationsByStoryId(storyId: string) {
    const locations = await this.getLocationsByStoryIdUseCase.execute(storyId)
    return locations.map((location) => LocationResponseSchema.parse(location))
  }

  async updateLocation(id: string, data: z.infer<typeof LocationUpdateSchema>) {
    const updatedLocation = await this.updateLocationUseCase.execute({ id, ...data })
    if (!updatedLocation) {
      throw new Error('Location not found or does not belong to the specified story')
    }
    return LocationResponseSchema.parse(updatedLocation)
  }

  async deleteLocation(id: string, storyId: string) {
    if (!storyId) {
      throw new Error('storyId is required for deletion')
    }
    const deleted = await this.deleteLocationUseCase.execute(id, storyId)
    if (!deleted) {
      throw new Error('Location not found or does not belong to the specified story')
    }
    return
  }
}
