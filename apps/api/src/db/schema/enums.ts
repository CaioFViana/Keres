import { dbEnum } from './columns';

export const storyTypeEnum = dbEnum('story_type', ['linear', 'branching']);
export const operationTypeEnum = dbEnum('operation_type', [
  'create',
  'update',
  'delete',
  'reorder',
]);
export const storyPermissionTypeEnum = dbEnum('story_permission_type', ['reader', 'writer']);
export const showcaseVisibilityEnum = dbEnum('showcase_visibility', ['public', 'password']);
export const publicationLabelModeEnum = dbEnum('publication_label_mode', [
  'version',
  'date',
  'both',
]);
export const apiLogLevelEnum = dbEnum('api_log_level', ['info', 'warn', 'error']);
