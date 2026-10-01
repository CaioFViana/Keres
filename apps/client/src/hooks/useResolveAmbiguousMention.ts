import type { SeeAlsoEntityType } from '@keres/shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
import { createSeeAlsoRelationService } from '../services/storymanagement/SeeAlsoRelationService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';

/**
 * One-touch resolution for ambiguous-name suggestions: links the source entity to the
 * tapped claimant in "See also". Additive only - unlike the managers' set reconcile, it
 * never removes - idempotent (re-tapping an already linked candidate returns the existing
 * row), and self-links are rejected by the service before anything is written.
 */
export function useResolveAmbiguousMention() {
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { t } = useTranslation();
  const service = useMemo(
    () => (drizzleDb ? createSeeAlsoRelationService(drizzleDb) : null),
    [drizzleDb],
  );

  return useCallback(
    async (
      storyId: string,
      source: { entityType: SeeAlsoEntityType; entityId: string },
      target: SeeAlsoEntityRef,
    ): Promise<boolean> => {
      if (!service || !userId) return false;
      try {
        await service.addSeeAlsoLink(userId, storyId, source, target);
        return true;
      } catch (error) {
        console.error('Failed to resolve ambiguous mention:', error);
        AppAlert.alert(t('error'), t('failed_to_resolve_ambiguous_mention'));
        return false;
      }
    },
    [service, userId, t],
  );
}
