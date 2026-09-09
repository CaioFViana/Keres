import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomizationStackParamList } from '../../navigation/MainSystemStack';
import type { StatService } from '../../services/storymanagement/StatService';
import { AppAlert } from '../../utils/AppAlert';
import type { StatFormState } from './useStatFormState';

type StatNavigation = NativeStackNavigationProp<CustomizationStackParamList, 'StatForm'>;

type UseStatFormActionsOptions = {
  state: StatFormState;
  statServiceRef: RefObject<StatService | null>;
  navigation: StatNavigation;
  storyId?: string;
  userId?: string | null;
  statsCount: number;
};

/** Owns validation, persistence, feedback and navigation for the Stat form. */
export function useStatFormActions({
  state,
  statServiceRef,
  navigation,
  storyId,
  userId,
  statsCount,
}: UseStatFormActionsOptions) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!state.name.trim()) {
      AppAlert.alert(t('error'), t('stat_name_required'));
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
    if (!statServiceRef.current) {
      AppAlert.alert(t('error'), t('stat_save_failed'));
      return;
    }

    setSaving(true);
    try {
      if (state.isEditing) {
        await statServiceRef.current.updateStat(userId, state.statId!, {
          name: state.name.trim(),
          isPrimary: state.isPrimary,
        });
      } else {
        await statServiceRef.current.createStat(userId, {
          storyId,
          name: state.name.trim(),
          isPrimary: state.isPrimary,
          order: statsCount,
        });
      }
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to save stat:', error);
      AppAlert.alert(t('error'), error?.message || t('stat_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [
    navigation,
    state.isEditing,
    state.isPrimary,
    state.name,
    state.statId,
    statServiceRef,
    statsCount,
    storyId,
    t,
    userId,
  ]);

  return { handleSave, saving };
}
