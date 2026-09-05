import type { Effect } from '@keres/shared/entities/Effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { createEffectService } from '../services/storymanagement/EffectService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';
import { entityEventEmitter } from '../utils/EventEmitter';

type EffectEntityType = 'Scene' | 'Choice';
type EffectChanges = Partial<
  Omit<
    Effect,
    | 'id'
    | 'storyId'
    | 'entityType'
    | 'entityId'
    | 'createdAt'
    | 'updatedAt'
    | 'version'
    | 'isDeleted'
    | 'deletedAt'
  >
>;

export function useEntityEffects(
  entityType: EffectEntityType,
  entityId: string | undefined,
  storyId: string | undefined,
  enabled: boolean,
) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const effectServiceRef = useRef<ReturnType<typeof createEffectService> | null>(null);
  const [effects, setEffects] = useState<Effect[]>([]);

  useEffect(() => {
    if (drizzleDb && !effectServiceRef.current) {
      effectServiceRef.current = createEffectService(drizzleDb);
    }
  }, [drizzleDb]);

  const fetchEffects = useCallback(async () => {
    if (!effectServiceRef.current || !storyId || !entityId) {
      setEffects([]);
      return;
    }
    try {
      setEffects(await effectServiceRef.current.getEffectsByEntity(storyId, entityType, entityId));
    } catch (err) {
      console.error('Failed to fetch effects:', err);
    }
  }, [storyId, entityType, entityId]);

  useEffect(() => {
    if (enabled) void fetchEffects();
  }, [enabled, fetchEffects]);

  const handleAddEffect = async () => {
    if (!userId || !storyId || !entityId || !effectServiceRef.current) return;
    try {
      const created = await effectServiceRef.current.createEffect(userId, {
        storyId,
        entityType,
        entityId,
        effectType: 'itemGrant',
        itemId: null,
        triggerName: null,
      });
      setEffects((prev) => [...prev, created]);
      entityEventEmitter.emit('effect_changed', storyId, entityId);
    } catch (err) {
      console.error('Failed to add effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleUpdateEffect = async (effectId: string, changes: EffectChanges) => {
    if (!userId || !effectServiceRef.current) return;
    try {
      const updated = await effectServiceRef.current.updateEffect(userId, effectId, changes);
      setEffects((prev) => prev.map((effect) => (effect.id === effectId ? updated : effect)));
      entityEventEmitter.emit('effect_changed', storyId, entityId);
    } catch (err) {
      console.error('Failed to update effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleChangeEffectType = (effectId: string, effectType: Effect['effectType']) => {
    void handleUpdateEffect(effectId, { effectType, itemId: null, triggerName: null });
  };

  const handleDeleteEffect = async (effectId: string) => {
    if (!userId || !effectServiceRef.current) return;
    try {
      await effectServiceRef.current.deleteEffect(userId, effectId);
      setEffects((prev) => prev.filter((effect) => effect.id !== effectId));
      entityEventEmitter.emit('effect_changed', storyId, entityId);
    } catch (err) {
      console.error('Failed to delete effect:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_effect'));
    }
  };

  return {
    effects,
    handleAddEffect,
    handleUpdateEffect,
    handleChangeEffectType,
    handleDeleteEffect,
  };
}
