import {
  type CustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { StorySchemaEntityType, StorySchemaField } from '@keres/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../db';
import { createAttributeValueService } from '../services/storymanagement/AttributeValueService';
import {
  type PersistedEntity,
  saveEntityWithSecondaryData,
} from '../services/storymanagement/EntityFormSaveCoordinator';
import { AppAlert } from '../utils/AppAlert';
import { entityEventEmitter } from '../utils/EventEmitter';
import { type ConfirmDeleteOptions, useConfirmDelete } from './useConfirmDelete';

export interface EntityFormActionsConfig<TData, TEntity extends PersistedEntity> {
  /** The entity type its custom attribute values are stored under, e.g. `'Location'`; omit for an entity with none. */
  entityType?: StorySchemaEntityType;
  /** Emitted once the entity and everything secondary is saved or deleted, e.g. `'location_changed'`; omit to emit none. */
  changeEvent?: string;
  storyId?: string;
  userId?: string | null;
  /** Needed with `entityType`, to save the attribute values. */
  drizzleDb?: AppDrizzleClient;
  /** The custom fields and values of an entity that has them: checked as required, then saved last. */
  customFields?: StorySchemaField[];
  customValues?: CustomAttributeValues;
  /** The entity being edited; undefined while creating. */
  currentEntityId?: string;
  /** Whether the entity's service is ready, asked when saving or deleting (its ref may be set after render). */
  isServiceReady(): boolean;
  clearFormDraft(): Promise<void>;
  /** Keeps the id once the row exists, so a retry after a partial save updates instead of duplicating. */
  retainPersistedId(entityId: string): void;
  /** The message to show when the form cannot be saved yet, or null. Runs first. */
  validate(): string | null;
  buildData(): TData;
  create(userId: string, storyId: string, data: TData): Promise<TEntity>;
  update(userId: string, entityId: string, data: TData): Promise<unknown>;
  remove(userId: string, entityId: string): Promise<void>;
  /** Secondary writes, in order (tags, notes, see-also, relations); the attribute values follow them. */
  secondarySteps?: ReadonlyArray<(entityId: string) => Promise<void>>;
  persistSecondaryDraft?(entityId: string): Promise<void>;
  clearSecondaryDraft?(entityId: string): Promise<void>;
  /** What the screen says: the failure to save, and the success after a create or an update. */
  messages: { failedToSave: string; created: string; updated: string };
  /** The delete confirmation, minus the parts this hook supplies. */
  confirmDelete: Omit<ConfirmDeleteOptions, 'onConfirm' | 'onLoadingChange'>;
  /** Where to go after a save: usually back, or into the form of the entity just created. */
  afterSave(entityId: string, created: boolean): void;
  afterDelete(): void;
  /** Logged with a failed save, e.g. `'location'`. */
  logName: string;
}

/**
 * Saving and deleting for an entity form: validation, the entity and its secondary data written in
 * the order that survives a partial failure, feedback, the change event and where to go next. What
 * differs per entity (fields, service calls, secondary steps, texts, navigation) is passed in; the
 * flow is the same for all of them.
 */
export function useEntityFormActions<TData, TEntity extends PersistedEntity>(
  config: EntityFormActionsConfig<TData, TEntity>,
) {
  const { t } = useTranslation();
  const confirmDelete = useConfirmDelete();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const { userId, storyId } = config;

  const handleSave = () =>
    runSave(async () => {
      const invalid = config.validate();
      if (invalid) {
        AppAlert.alert(t('error'), invalid);
        return;
      }
      const missingRequiredField =
        config.customFields && config.customValues
          ? validateRequiredCustomAttributes(config.customFields, config.customValues)
          : null;
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!storyId) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }
      if (!config.isServiceReady()) {
        AppAlert.alert(t('error'), config.messages.failedToSave);
        return;
      }

      try {
        const data = config.buildData();
        const { entityId, created } = await saveEntityWithSecondaryData({
          currentEntityId: config.currentEntityId,
          createEntity: () => config.create(userId, storyId, data),
          updateEntity: (id) => config.update(userId, id, data),
          onEntityPersisted: config.retainPersistedId,
          persistSecondaryDraft: config.persistSecondaryDraft,
          clearSecondaryDraft: config.clearSecondaryDraft,
          persistSecondaryData: async (id) => {
            for (const step of config.secondarySteps ?? []) await step(id);
            if (config.entityType && config.customValues && config.drizzleDb) {
              await createAttributeValueService(config.drizzleDb).saveValuesForEntity(
                userId,
                storyId,
                config.entityType,
                id,
                config.customValues,
              );
            }
          },
        });

        await config.clearFormDraft();
        if (config.changeEvent) entityEventEmitter.emit(config.changeEvent, storyId, entityId);
        AppAlert.alert(t('success'), created ? config.messages.created : config.messages.updated);
        config.afterSave(entityId, created);
      } catch (err) {
        console.error(`Failed to save ${config.logName}:`, err);
        AppAlert.alert(t('error'), config.messages.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    const entityId = config.currentEntityId;
    if (!entityId || !config.isServiceReady()) return;

    confirmDelete({
      ...config.confirmDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await config.remove(userId, entityId);
        await config.clearFormDraft();
        if (config.changeEvent) entityEventEmitter.emit(config.changeEvent, storyId, entityId);
        config.afterDelete();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving };
}
