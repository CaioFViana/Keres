export interface Chapter {
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
