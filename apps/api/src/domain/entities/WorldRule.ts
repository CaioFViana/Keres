export interface WorldRule {
  id: string;
  storyId: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}