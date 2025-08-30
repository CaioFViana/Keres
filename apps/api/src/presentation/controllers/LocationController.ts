import { Context } from 'hono';
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  GetLocationsByStoryIdUseCase,
  UpdateLocationUseCase,
  DeleteLocationUseCase,
} from '@application/use-cases';
import { createLocationSchema, updateLocationSchema, locationProfileSchema } from '@presentation/schemas/LocationSchemas';

export class LocationController {
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
    private readonly getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase
  ) {}

  async createLocation(c: Context) {
    const body = await c.req.json();
    const validation = createLocationSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const locationProfile = await this.createLocationUseCase.execute(validation.data);
      return c.json(locationProfileSchema.parse(locationProfile), 201);
    } catch (error: any) {
      console.error('Error creating location:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getLocation(c: Context) {
    const locationId = c.req.param('id');

    try {
      const locationProfile = await this.getLocationUseCase.execute(locationId);
      if (!locationProfile) {
        return c.json({ error: 'Location not found' }, 404);
      }
      return c.json(locationProfileSchema.parse(locationProfile), 200);
    } catch (error: any) {
      console.error('Error getting location:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getLocationsByStoryId(c: Context) {
    const storyId = c.req.param('storyId');

    try {
      const locations = await this.getLocationsByStoryIdUseCase.execute(storyId);
      return c.json(locations.map(location => locationProfileSchema.parse(location)), 200);
    } catch (error: any) {
      console.error('Error getting locations by story ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateLocation(c: Context) {
    const locationId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateLocationSchema.safeParse({ id: locationId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedLocation = await this.updateLocationUseCase.execute(validation.data);
      if (!updatedLocation) {
        return c.json({ error: 'Location not found or unauthorized' }, 404);
      }
      return c.json(locationProfileSchema.parse(updatedLocation), 200);
    } catch (error: any) {
      console.error('Error updating location:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteLocation(c: Context) {
    const locationId = c.req.param('id');
    // Assuming storyId comes from the request body or a header for authorization
    const storyId = c.req.header('x-story-id'); // For testing purposes

    if (!storyId) {
      return c.json({ error: 'Unauthorized: Missing story ID' }, 401);
    }

    try {
      const deleted = await this.deleteLocationUseCase.execute(locationId, storyId);
      if (!deleted) {
        return c.json({ error: 'Location not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Location deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting location:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
