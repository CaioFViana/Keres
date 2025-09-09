import type { Tag } from '@domain/entities/Tag'

export interface ITagRepository {
  findById(tagId: string): Promise<Tag | null>
  addTagToCharacter(characterId: string, tagId: string): Promise<void>
  removeTagFromCharacter(characterId: string, tagId: string): Promise<void>
  addTagToLocation(locationId: string, tagId: string): Promise<void>
  removeTagFromLocation(locationId: string, tagId: string): Promise<void>
  addTagToChapter(chapterId: string, tagId: string): Promise<void>
  removeTagFromChapter(chapterId: string, tagId: string): Promise<void>
  addTagToScene(sceneId: string, tagId: string): Promise<void>
  removeTagFromScene(sceneId: string, tagId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
