import type { Location } from '@domain/entities/Location'

export interface ILocationRepository {
  findById(id: string): Promise<Location | null>
  findByStoryId(storyId: string): Promise<Location[]>
  save(location: Location): Promise<void>
  update(location: Location, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
