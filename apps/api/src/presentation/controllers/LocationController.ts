import type {
  BulkDeleteLocationUseCase,
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
  type PaginatedResponse,
} from '@keres/shared'

export class LocationController {
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
    private readonly bulkDeleteLocationUseCase: BulkDeleteLocationUseCase,
    private readonly getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase,
  ) {}

  async createLocation(userId: string, data: z.infer<typeof LocationCreateSchema>) {
    const location = await this.createLocationUseCase.execute(userId, data)
    return LocationResponseSchema.parse(location)
  }

  async getLocation(userId: string, id: string, include: string[] = []) {
    const location = await this.getLocationUseCase.execute(userId, id, include)
    if (!location) {
      throw new Error('Location not found')
    }
    return LocationResponseSchema.parse(location)
  }

  async getLocationsByStoryId(
    userId: string,
    storyId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof LocationResponseSchema>>> {
    const paginatedLocations = await this.getLocationsByStoryIdUseCase.execute(userId, storyId, query)
    const items = paginatedLocations.items.map((location) => LocationResponseSchema.parse(location))

    return {
      items,
      totalItems: paginatedLocations.totalItems,
    }
  }

  async updateLocation(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof LocationUpdateSchema>, 'id'>,
  ) {
    const updatedLocation = await this.updateLocationUseCase.execute(userId, id, data)
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

  async bulkDeleteLocations(userId: string, ids: string[]) {
    const result = await this.bulkDeleteLocationUseCase.execute(userId, ids)
    return result
  }
}
