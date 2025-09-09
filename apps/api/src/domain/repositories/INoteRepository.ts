import type { Note } from '@domain/entities/Note'
import type { ListQueryParams } from '@keres/shared'

export interface INoteRepository {
  findById(id: string): Promise<Note | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<Note[]>
  findByGalleryId(galleryId: string): Promise<Note[]>
  save(note: Note): Promise<void>
  update(note: Note, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
