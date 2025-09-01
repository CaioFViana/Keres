import type {
  ChapterResponse,
  CharacterMomentResponse,
  CharacterResponse,
  CreateChapterPayload,
  CreateCharacterMomentPayload,
  CreateCharacterPayload,
  CreateGalleryPayload,
  CreateLocationPayload,
  CreateMomentPayload,
  CreateNotePayload,
  CreateScenePayload,
  CreateStoryPayload,
  CreateSuggestionPayload,
  CreateTagPayload,
  CreateWorldRulePayload,
  GalleryResponse,
  LocationResponse,
  MomentResponse,
  NoteResponse,
  SceneResponse,
  StoryResponse,
  SuggestionResponse,
  TagResponse,
  UpdateChapterPayload,
  UpdateCharacterMomentPayload,
  UpdateCharacterPayload,
  UpdateGalleryPayload,
  UpdateLocationPayload,
  UpdateMomentPayload,
  UpdateNotePayload,
  UpdateScenePayload,
  UpdateStoryPayload,
  UpdateSuggestionPayload,
  UpdateTagPayload,
  UpdateWorldRulePayload,
  UserLoginPayload,
  UserProfileResponse,
  WorldRuleResponse,
  CharacterRelationResponse,
  CreateCharacterRelationPayload,
  UpdateCharacterRelationPayload,
  RelationResponse, // Added
  CreateRelationPayload, // Added
  UpdateRelationPayload, // Added
} from '@keres/shared'

import axios from 'axios'

const API_BASE_URL = 'http://localhost:3000' // Replace with your backend API URL

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const loginUser = async (credentials: UserLoginPayload): Promise<UserProfileResponse> => {
  const response = await api.post('/users/login', credentials)
  return response.data
}

// You can add more API calls here for other entities (stories, characters, etc.)
// Example for a protected route (requires token)
export const getProtectedData = async (token: string): Promise<any> => {
  const response = await api.get('/stories', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const getStoriesByUserId = async (
  token: string,
  userId: string,
): Promise<StoryResponse[]> => {
  const response = await api.get(`/stories/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createStory = async (
  token: string,
  payload: CreateStoryPayload,
): Promise<StoryResponse> => {
  const response = await api.post('/stories', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateStory = async (
  token: string,
  payload: UpdateStoryPayload,
): Promise<StoryResponse> => {
  const response = await api.put(`/stories/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteStory = async (token: string, storyId: string): Promise<void> => {
  await api.delete(`/stories/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getCharactersByStoryId = async (
  token: string,
  storyId: string,
): Promise<CharacterResponse[]> => {
  const response = await api.get(`/characters/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createCharacter = async (
  token: string,
  payload: CreateCharacterPayload,
): Promise<CharacterResponse> => {
  const response = await api.post('/characters', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateCharacter = async (
  token: string,
  payload: UpdateCharacterPayload,
): Promise<CharacterResponse> => {
  const response = await api.put(`/characters/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteCharacter = async (token: string, characterId: string): Promise<void> => {
  await api.delete(`/characters/${characterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getChaptersByStoryId = async (
  token: string,
  storyId: string,
): Promise<ChapterResponse[]> => {
  const response = await api.get(`/chapters/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createChapter = async (
  token: string,
  payload: CreateChapterPayload,
): Promise<ChapterResponse> => {
  const response = await api.post('/chapters', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateChapter = async (
  token: string,
  payload: UpdateChapterPayload,
): Promise<ChapterResponse> => {
  const response = await api.put(`/chapters/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteChapter = async (token: string, chapterId: string): Promise<void> => {
  await api.delete(`/chapters/${chapterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getScenesByChapterId = async (
  token: string,
  chapterId: string,
): Promise<SceneResponse[]> => {
  const response = await api.get(`/scenes/chapter/${chapterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createScene = async (
  token: string,
  payload: CreateScenePayload,
): Promise<SceneResponse> => {
  const response = await api.post('/scenes', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateScene = async (
  token: string,
  payload: UpdateScenePayload,
): Promise<SceneResponse> => {
  const response = await api.put(`/scenes/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteScene = async (token: string, sceneId: string): Promise<void> => {
  await api.delete(`/scenes/${sceneId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getMomentsBySceneId = async (
  token: string,
  sceneId: string,
): Promise<MomentResponse[]> => {
  const response = await api.get(`/moments/scene/${sceneId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createMoment = async (
  token: string,
  payload: CreateMomentPayload,
): Promise<MomentResponse> => {
  const response = await api.post('/moments', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateMoment = async (
  token: string,
  payload: UpdateMomentPayload,
): Promise<MomentResponse> => {
  const response = await api.put(`/moments/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteMoment = async (token: string, momentId: string): Promise<void> => {
  await api.delete(`/moments/${momentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getLocationsByStoryId = async (
  token: string,
  storyId: string,
): Promise<LocationResponse[]> => {
  const response = await api.get(`/locations/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createLocation = async (
  token: string,
  payload: CreateLocationPayload,
): Promise<LocationResponse> => {
  const response = await api.post('/locations', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateLocation = async (
  token: string,
  payload: UpdateLocationPayload,
): Promise<LocationResponse> => {
  const response = await api.put(`/locations/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteLocation = async (token: string, locationId: string): Promise<void> => {
  await api.delete(`/locations/${locationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getGalleriesByStoryId = async (
  token: string,
  storyId: string,
): Promise<GalleryResponse[]> => {
  const response = await api.get(`/galleries/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createGallery = async (
  token: string,
  payload: CreateGalleryPayload,
): Promise<GalleryResponse> => {
  const response = await api.post('/galleries', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateGallery = async (
  token: string,
  payload: UpdateGalleryPayload,
): Promise<GalleryResponse> => {
  const response = await api.put(`/galleries/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteGallery = async (token: string, galleryId: string): Promise<void> => {
  await api.delete(`/galleries/${galleryId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getNotesByStoryId = async (
  token: string,
  storyId: string,
): Promise<NoteResponse[]> => {
  const response = await api.get(`/notes/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createNote = async (
  token: string,
  payload: CreateNotePayload,
): Promise<NoteResponse> => {
  const response = await api.post('/notes', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateNote = async (
  token: string,
  payload: UpdateNotePayload,
): Promise<NoteResponse> => {
  const response = await api.put(`/notes/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteNote = async (token: string, noteId: string): Promise<void> => {
  await api.delete(`/notes/${noteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getTagsByStoryId = async (token: string, storyId: string): Promise<TagResponse[]> => {
  const response = await api.get(`/tags/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createTag = async (token: string, payload: CreateTagPayload): Promise<TagResponse> => {
  const response = await api.post('/tags', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateTag = async (token: string, payload: UpdateTagPayload): Promise<TagResponse> => {
  const response = await api.put(`/tags/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteTag = async (token: string, tagId: string): Promise<void> => {
  await api.delete(`/tags/${tagId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getWorldRulesByStoryId = async (
  token: string,
  storyId: string,
): Promise<WorldRuleResponse[]> => {
  const response = await api.get(`/world-rules/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createWorldRule = async (
  token: string,
  payload: CreateWorldRulePayload,
): Promise<WorldRuleResponse> => {
  const response = await api.post('/world-rules', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateWorldRule = async (
  token: string,
  payload: UpdateWorldRulePayload,
): Promise<WorldRuleResponse> => {
  const response = await api.put(`/world-rules/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteWorldRule = async (token: string, worldRuleId: string): Promise<void> => {
  await api.delete(`/world-rules/${worldRuleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getSuggestionsByUserId = async (
  token: string,
  userId: string,
): Promise<SuggestionResponse[]> => {
  const response = await api.get(`/suggestions/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createSuggestion = async (
  token: string,
  payload: CreateSuggestionPayload,
): Promise<SuggestionResponse> => {
  const response = await api.post('/suggestions', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateSuggestion = async (
  token: string,
  payload: UpdateSuggestionPayload,
): Promise<SuggestionResponse> => {
  const response = await api.put(`/suggestions/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteSuggestion = async (token: string, suggestionId: string): Promise<void> => {
  await api.delete(`/suggestions/${suggestionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getCharacterMomentsByCharacterId = async (
  token: string,
  characterId: string,
): Promise<CharacterMomentResponse[]> => {
  const response = await api.get(`/character-moments/character/${characterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createCharacterMoment = async (
  token: string,
  payload: CreateCharacterMomentPayload,
): Promise<CharacterMomentResponse> => {
  const response = await api.post('/character-moments', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateCharacterMoment = async (
  token: string,
  payload: UpdateCharacterMomentPayload,
): Promise<CharacterMomentResponse> => {
  const response = await api.put(`/character-moments/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteCharacterMoment = async (
  token: string,
  characterMomentId: string,
): Promise<void> => {
  await api.delete(`/character-moments/${characterMomentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getCharacterRelationsByCharacterId = async (
  token: string,
  characterId: string,
): Promise<CharacterRelationResponse[]> => {
  const response = await api.get(`/character-relations/character/${characterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createCharacterRelation = async (
  token: string,
  payload: CreateCharacterRelationPayload,
): Promise<CharacterRelationResponse> => {
  const response = await api.post('/character-relations', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateCharacterRelation = async (
  token: string,
  payload: UpdateCharacterRelationPayload,
): Promise<CharacterRelationResponse> => {
  const response = await api.put(`/character-relations/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteCharacterRelation = async (
  token: string,
  characterRelationId: string,
): Promise<void> => {
  await api.delete(`/character-relations/${characterRelationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const getRelationsByStoryId = async (
  token: string,
  storyId: string,
): Promise<RelationResponse[]> => {
  const response = await api.get(`/relations/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const createRelation = async (
  token: string,
  payload: CreateRelationPayload,
): Promise<RelationResponse> => {
  const response = await api.post('/relations', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const updateRelation = async (
  token: string,
  payload: UpdateRelationPayload,
): Promise<RelationResponse> => {
  const response = await api.put(`/relations/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const deleteRelation = async (token: string, relationId: string): Promise<void> => {
  await api.delete(`/relations/${relationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
