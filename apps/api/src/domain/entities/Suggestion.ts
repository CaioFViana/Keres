export interface Suggestion {
  id: string;
  userId: string;
  scope: 'global' | 'story';
  storyId: string | null;
  type: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}