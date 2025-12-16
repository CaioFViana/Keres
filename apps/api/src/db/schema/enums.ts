import { pgEnum } from 'drizzle-orm/pg-core';

export const storyTypeEnum = pgEnum('story_type', ['linear', 'branching']);
export const operationTypeEnum = pgEnum('operation_type', ['create', 'update', 'delete']);
export const storyPermissionTypeEnum = pgEnum('story_permission_type', ['reader', 'writer']);
