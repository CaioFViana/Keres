import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { createChoiceCheckGroupService } from '../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../services/storymanagement/ChoiceCheckService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';
import { entityEventEmitter } from '../utils/EventEmitter';

type CheckChanges = Partial<
  Omit<
    ChoiceCheck,
    'id' | 'storyId' | 'groupId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
  >
>;

export function useChoiceChecks(
  choiceId: string | undefined,
  storyId: string | undefined,
  enabled: boolean,
) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const groupServiceRef = useRef<ReturnType<typeof createChoiceCheckGroupService> | null>(null);
  const checkServiceRef = useRef<ReturnType<typeof createChoiceCheckService> | null>(null);
  const [checkGroups, setCheckGroups] = useState<ChoiceCheckGroup[]>([]);
  const [checks, setChecks] = useState<ChoiceCheck[]>([]);

  useEffect(() => {
    if (!drizzleDb) return;
    if (!groupServiceRef.current)
      groupServiceRef.current = createChoiceCheckGroupService(drizzleDb);
    if (!checkServiceRef.current) checkServiceRef.current = createChoiceCheckService(drizzleDb);
  }, [drizzleDb]);

  const fetchChecks = useCallback(async () => {
    if (!groupServiceRef.current || !checkServiceRef.current || !storyId || !choiceId) {
      setCheckGroups([]);
      setChecks([]);
      return;
    }
    try {
      const groups = await groupServiceRef.current.getChoiceCheckGroupsByChoiceId(
        storyId,
        choiceId,
      );
      setCheckGroups(groups);
      const checksByGroup = await Promise.all(
        groups.map((group) => checkServiceRef.current!.getChoiceChecksByGroupId(storyId, group.id)),
      );
      setChecks(checksByGroup.flat());
    } catch (err) {
      console.error('Failed to load choice checks:', err);
    }
  }, [storyId, choiceId]);

  useEffect(() => {
    if (enabled) void fetchChecks();
  }, [enabled, fetchChecks]);

  const handleAddCheckGroup = async () => {
    if (!userId || !storyId || !choiceId || !groupServiceRef.current) return;
    try {
      const newGroup = await groupServiceRef.current.createChoiceCheckGroup(userId, {
        storyId,
        choiceId,
        combinator: 'AND',
        order: Math.max(0, ...checkGroups.map((group) => group.order + 1)),
      });
      setCheckGroups((prev) => [...prev, newGroup]);
      entityEventEmitter.emit('choice_check_group_changed', storyId, choiceId);
    } catch (err) {
      console.error('Failed to add check group:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check_group'));
    }
  };

  const handleUpdateCheckGroupCombinator = async (groupId: string, combinator: 'AND' | 'OR') => {
    if (!userId || !groupServiceRef.current) return;
    try {
      const updated = await groupServiceRef.current.updateChoiceCheckGroup(userId, groupId, {
        combinator,
      });
      setCheckGroups((prev) => prev.map((group) => (group.id === groupId ? updated : group)));
    } catch (err) {
      console.error('Failed to update check group:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check_group'));
    }
  };

  const handleDeleteCheckGroup = async (groupId: string) => {
    if (!userId || !groupServiceRef.current || !checkServiceRef.current) return;
    try {
      for (const check of checks.filter((item) => item.groupId === groupId)) {
        await checkServiceRef.current.deleteChoiceCheck(userId, check.id);
      }
      await groupServiceRef.current.deleteChoiceCheckGroup(userId, groupId);
      setCheckGroups((prev) => prev.filter((group) => group.id !== groupId));
      setChecks((prev) => prev.filter((check) => check.groupId !== groupId));
      entityEventEmitter.emit('choice_check_group_changed', storyId, choiceId);
    } catch (err) {
      console.error('Failed to delete check group:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_check_group'));
    }
  };

  const handleAddCheck = async (groupId: string) => {
    if (!userId || !storyId || !checkServiceRef.current) return;
    try {
      const checksInGroup = checks.filter((check) => check.groupId === groupId);
      const created = await checkServiceRef.current.createChoiceCheck(userId, {
        storyId,
        groupId,
        mode: 'block',
        type: 'sceneCount',
        order: Math.max(0, ...checksInGroup.map((check) => check.order + 1)),
        sceneId: null,
        minVisits: null,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      });
      setChecks((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to add check:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check'));
    }
  };

  const handleUpdateCheck = async (checkId: string, changes: CheckChanges) => {
    if (!userId || !checkServiceRef.current) return;
    try {
      const updated = await checkServiceRef.current.updateChoiceCheck(userId, checkId, changes);
      setChecks((prev) => prev.map((check) => (check.id === checkId ? updated : check)));
    } catch (err) {
      console.error('Failed to update check:', err);
      AppAlert.alert(t('error'), t('failed_to_save_check'));
    }
  };

  const handleDeleteCheck = async (checkId: string) => {
    if (!userId || !checkServiceRef.current) return;
    try {
      await checkServiceRef.current.deleteChoiceCheck(userId, checkId);
      setChecks((prev) => prev.filter((check) => check.id !== checkId));
    } catch (err) {
      console.error('Failed to delete check:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_check'));
    }
  };

  const handleChangeCheckType = (checkId: string, type: ChoiceCheck['type']) => {
    void handleUpdateCheck(checkId, {
      type,
      sceneId: null,
      minVisits: type === 'sceneCount' ? 1 : null,
      itemId: null,
      itemPresence: type === 'inventory' ? 'has' : null,
      triggerName: null,
      triggerState: type === 'trigger' ? 'set' : null,
    });
  };

  return {
    checkGroups,
    checks,
    handleAddCheckGroup,
    handleUpdateCheckGroupCombinator,
    handleDeleteCheckGroup,
    handleAddCheck,
    handleUpdateCheck,
    handleDeleteCheck,
    handleChangeCheckType,
  };
}
