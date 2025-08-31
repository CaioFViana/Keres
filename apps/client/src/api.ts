import axios from 'axios';
import { UserLoginPayload, UserProfileResponse, StoryResponse, CreateStoryPayload, UpdateStoryPayload, CharacterResponse, CreateCharacterPayload, UpdateCharacterPayload } from '@keres/shared';

const API_BASE_URL = 'http://localhost:3000'; // Replace with your backend API URL

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const loginUser = async (credentials: UserLoginPayload): Promise<UserProfileResponse> => {
  const response = await api.post('/users/login', credentials);
  return response.data;
};

// You can add more API calls here for other entities (stories, characters, etc.)
// Example for a protected route (requires token)
export const getProtectedData = async (token: string): Promise<any> => {
  const response = await api.get('/stories', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getStoriesByUserId = async (token: string, userId: string): Promise<StoryResponse[]> => {
  const response = await api.get(`/stories/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createStory = async (token: string, payload: CreateStoryPayload): Promise<StoryResponse> => {
  const response = await api.post('/stories', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateStory = async (token: string, payload: UpdateStoryPayload): Promise<StoryResponse> => {
  const response = await api.put(`/stories/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteStory = async (token: string, storyId: string): Promise<void> => {
  await api.delete(`/stories/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getCharactersByStoryId = async (token: string, storyId: string): Promise<CharacterResponse[]> => {
  const response = await api.get(`/characters/story/${storyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createCharacter = async (token: string, payload: CreateCharacterPayload): Promise<CharacterResponse> => {
  const response = await api.post('/characters', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateCharacter = async (token: string, payload: UpdateCharacterPayload): Promise<CharacterResponse> => {
  const response = await api.put(`/characters/${payload.id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteCharacter = async (token: string, characterId: string): Promise<void> => {
  await api.delete(`/characters/${characterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};