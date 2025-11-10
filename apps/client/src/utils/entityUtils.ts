import { createULID } from './ulid';

export type BaseEntityFieldNames = 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt';

export type Create<T> = Omit<T, BaseEntityFieldNames>;

interface BaseEntityFields {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt?: Date | null; // Made optional to match Drizzle's Insert types
}

export function prepareNewEntityData<T extends BaseEntityFields>(
  data: Create<T>
): T {
  const now = new Date();
  return {
    id: createULID(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null, // Explicitly set to null if not provided in data
    ...data,
  } as T;
}
