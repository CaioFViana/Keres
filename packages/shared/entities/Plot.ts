export interface Plot {
  id: string;
  storyId: string;
  name: string;
  details: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
