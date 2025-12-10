import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared'; // These types should be from shared
import { AppDrizzleClient } from '../../db'; // Assuming '../db' exports AppDrizzleClient

export interface ClientSyncEntityHandler {
  entityName: string;

  // Method to set the db instance (useful if handlers are instantiated once)
  setDb(dbInstance: AppDrizzleClient): void;

  // Methods to apply updates locally
  applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void>;
  applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void>;
  applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void>;

  // Optional: Method to get an entity by ID locally
  getById?(id: string): Promise<any | undefined>;
}