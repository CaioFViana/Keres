import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { AppDrizzleClient } from '../../db';

export interface ClientSyncEntityHandler {
  entityName: string;
  setDb(dbInstance: AppDrizzleClient): void;
  applyCreate(entityId: string, update: CreateStoryUpdate): Promise<void>;
  applyUpdate(entityId: string, update: UpdateStoryUpdate): Promise<void>;
  applyDelete(entityId: string, update: DeleteStoryUpdate): Promise<void>;
  getById(id: string): Promise<any | undefined>; // Using 'any' for now, specific entity type would be ideal but requires generics
}
