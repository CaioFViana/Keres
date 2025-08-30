export interface CreateChapterDTO {
  storyId: string;
  name: string;
  index: number;
  summary?: string | null;
  isFavorite?: boolean;
  extraNotes?: string | null;
}

export interface UpdateChapterDTO {
  id: string;
  storyId: string;
  name?: string;
  index?: number;
  summary?: string | null;
  isFavorite?: boolean;
  extraNotes?: string | null;
}

export interface ChapterProfileDTO {
  id: string;
  storyId: string;
  name: string;
  index: number;
  summary: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
