/**
 * One visit in a Route. `selectedChoiceId` is the Choice taken out of this visit and is null only
 * at the final step. Keeping visit rows rather than an array of Scene ids makes loops unambiguous.
 */
export interface RouteStep {
  id: string;
  storyId: string;
  routeId: string;
  position: number;
  sceneId: string;
  selectedChoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
