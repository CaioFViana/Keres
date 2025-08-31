export interface Tag {
  id: string;
  storyId: string;
  name: string;
  color: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}