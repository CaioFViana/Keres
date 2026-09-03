/** An authored possible traversal of a branching story. It is not a save game or a Plot. */
export interface Route {
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
