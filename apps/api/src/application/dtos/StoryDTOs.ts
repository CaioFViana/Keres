export interface CreateStoryDTO {
  userId: string;
  title: string;
  summary?: string;
  genre?: string;
  language?: string;
  isFavorite?: boolean;
  extraNotes?: string;
}

export interface UpdateStoryDTO {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  genre?: string;
  language?: string;
  isFavorite?: boolean;
  extraNotes?: string;
}

export interface StoryProfileDTO {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  genre: string | null;
  language: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
