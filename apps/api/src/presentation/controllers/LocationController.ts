import type {
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
} from '@application/use-cases'
import type { z } from 'zod'

import {
  type ListQueryParams,
  type LocationCreateSchema,
  LocationResponseSchema,
  type LocationUpdateSchema,
} from '@keres/shared'

export class LocationController {
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
    private readonly getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase,
  ) {}

  async createLocation(userId: string, data: z.infer<typeof LocationCreateSchema>) {
    const location = await this.createLocationUseCase.execute(userId, data)
    return LocationResponseSchema.parse(location)
  }

  async getLocation(userId: string, id: string) {
    const location = await this.getLocationUseCase.execute(userId, id)
    if (!location) {
      throw new Error('Location not found')
    }
    return LocationResponseSchema.parse(location)
  }

  async getLocationsByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const locations = await this.getLocationsByStoryIdUseCase.execute(userId, storyId, query)
    return locations.map((location) => LocationResponseSchema.parse(location))
  }

  async updateLocation(userId: string, id: string, data: z.infer<typeof LocationUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedLocation = await this.updateLocationUseCase.execute(userId, { id, ...updateData })
    if (!updatedLocation) {
      throw new Error('Location not found or does not belong to the specified story')
    }
    return LocationResponseSchema.parse(updatedLocation)
  }

  async deleteLocation(userId: string, id: string) {
    const deleted = await this.deleteLocationUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Location not found or does not belong to the specified story')
    }
    return
  }
}
