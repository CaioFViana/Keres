import { pgEnum } from 'drizzle-orm/pg-core';

export const storyTypeEnum = pgEnum('story_type', ['linear', 'branching']);
export const operationTypeEnum = pgEnum('operation_type', [
  'create',
  'update',
  'delete',
  'reorder',
]);
export const storyPermissionTypeEnum = pgEnum('story_permission_type', ['reader', 'writer']);
export const apiLogLevelEnum = pgEnum('api_log_level', ['info', 'warn', 'error']);
