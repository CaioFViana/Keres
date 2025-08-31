export interface Note {
  id: string;
  storyId: string;
  title: string;
  body: string | null;
  galleryId: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}