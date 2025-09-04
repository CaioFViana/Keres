import type { Note } from '@domain/entities/Note'

export interface INoteRepository {
  findById(id: string): Promise<Note | null>
  findByStoryId(storyId: string): Promise<Note[]>
  save(note: Note): Promise<void>
  update(note: Note, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
