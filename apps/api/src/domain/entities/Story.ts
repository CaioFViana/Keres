export interface Story {
  id: string;
  userId: string;
  title: string;
  summary: string;
  genre: string;
  language: string;
  isFavorite: boolean;
  extraNotes: string;
  createdAt: Date;
  updatedAt: Date;
}
