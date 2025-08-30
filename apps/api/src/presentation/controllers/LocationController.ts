import type {
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { LocationResponseSchema } from '@keres/shared'

export class LocationController {
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
    private readonly getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase,
  ) {}

  async createLocation(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const location = await this.createLocationUseCase.execute(data)
      return c.json(LocationResponseSchema.parse(location), 201)
    } catch (_error: any) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getLocation(c: Context) {
    const locationId = c.req.param('id')

    try {
      const location = await this.getLocationUseCase.execute(locationId)
      if (!location) {
        return c.json({ error: 'Location not found' }, 404)
      }
      return c.json(LocationResponseSchema.parse(location), 200)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getLocationsByStoryId(c: Context) {
    const storyId = c.req.param('storyId') // Assuming storyId is passed as a param

    try {
      const locations = await this.getLocationsByStoryIdUseCase.execute(storyId)
      return c.json(
        locations.map((location) => LocationResponseSchema.parse(location)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async updateLocation(c: Context) {
    const locationId = c.req.param('id')
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const updatedLocation = await this.updateLocationUseCase.execute({ id: locationId, ...data })
      if (!updatedLocation) {
        return c.json(
          { error: 'Location not found or does not belong to the specified story' },
          404,
        )
      }
      return c.json(LocationResponseSchema.parse(updatedLocation), 200)
    } catch (_error: any) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteLocation(c: Context) {
    const locationId = c.req.param('id')
    const storyId = c.req.query('storyId') // Assuming storyId is passed as a query param for delete

    if (!storyId) {
      return c.json({ error: 'storyId is required for deletion' }, 400)
    }

    try {
      const deleted = await this.deleteLocationUseCase.execute(locationId, storyId)
      if (!deleted) {
        return c.json(
          { error: 'Location not found or does not belong to the specified story' },
          404,
        )
      }
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
