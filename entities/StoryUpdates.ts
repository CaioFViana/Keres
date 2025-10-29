export interface StoryUpdates {
  id: string; // Unique ID for this specific operation/update record
  entityId: string; // The ID of the entity being affected (e.g., storyId, chapterId)
  entityType: 'Story' | 'Chapter' | 'Scene' | 'Character' | 'Location' | 'Choice' | 'Note' | 'Tag' | 'WorldRule' | 'Gallery' | 'Suggestion' | 'CharacterRelation' | 'CharacterScene' | 'User'; // Type of entity being operated on
  operationType: 'INSERT' | 'UPDATE' | 'DELETE'; // Type of operation
  payload: any; // The data related to the operation (e.g., new story title, updated scene content). For DELETE, this might be null or just the ID.
  userId: string; // The user who performed the operation
  clientId: string; // The client (device) where the operation originated
  timestamp: number; // When the operation occurred (Unix timestamp)
  version: number; // Version of the entity after this operation
}
