export interface CreateSceneDTO {
  chapterId: string;
  name: string;
  index: number;
  summary?: string | null;
  gap?: string | null;
  duration?: string | null;
  isFavorite?: boolean;
  extraNotes?: string | null;
}

export interface UpdateSceneDTO {
  id: string;
  chapterId: string;
  name?: string;
  index?: number;
  summary?: string | null;
  gap?: string | null;
  duration?: string | null;
  isFavorite?: boolean;
  extraNotes?: string | null;
}

export interface SceneProfileDTO {
  id: string;
  chapterId: string;
  name: string;
  index: number;
  summary: string | null;
  gap: string | null;
  duration: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
