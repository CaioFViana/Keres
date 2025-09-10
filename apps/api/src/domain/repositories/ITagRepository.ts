import type { Tag } from '@domain/entities/Tag'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

export interface ITagRepository {
  findById(tagId: string): Promise<Tag | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Tag>>
  addTagToCharacter(characterId: string, tagId: string): Promise<void>
  removeTagFromCharacter(characterId: string, tagId: string): Promise<void>
  addTagToLocation(locationId: string, tagId: string): Promise<void>
  removeTagFromLocation(locationId: string, tagId: string): Promise<void>
  addTagToChapter(chapterId: string, tagId: string): Promise<void>
  removeTagFromChapter(chapterId: string, tagId: string): Promise<void>
  addTagToScene(sceneId: string, tagId: string): Promise<void>
  removeTagFromScene(sceneId: string, tagId: string): Promise<void>
  deleteCharacterTagsByCharacterId(characterId: string): Promise<void>
  deleteLocationTagsByLocationId(locationId: string): Promise<void>
  deleteChapterTagsByChapterId(chapterId: string): Promise<void>
  deleteSceneTagsBySceneId(sceneId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
