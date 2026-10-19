import { getEntityConflictLabelKey } from '@keres/shared';
import type { TFunction } from 'i18next';
import type { PushOutcomeReport } from './SyncPush';

/** How many refusals the message names; the rest are only counted, so the alert stays readable. */
export const MANUAL_SYNC_LISTED_REFUSALS = 3;

/**
 * The text for a save made by hand that the server did not fully take, or `undefined` when all of it landed (the
 * caller then shows the success message). Each refusal is named by its reason (`conflict_reason_*`), never by the
 * server's technical message: that one is in English and is meant for the log.
 */
export function manualSyncRefusalText(report: PushOutcomeReport, t: TFunction): string | undefined {
  if (report.conflicts <= 0) return undefined;

  const named = report.refusals.slice(0, MANUAL_SYNC_LISTED_REFUSALS).map((conflict) => {
    const entity = t(getEntityConflictLabelKey(conflict.entity), { defaultValue: conflict.entity });
    return t(`conflict_reason_${conflict.reason}`, {
      defaultValue: t('conflict_reason_unknown'),
      entity,
    });
  });
  // Quarantined changes never reach the server, so they come with no refusal to name.
  const items = named.length > 0 ? named : [t('conflict_reason_unknown')];
  const more = report.conflicts - items.length;

  return [
    t('sync_manual_conflicts_intro'),
    ...items.map((item) => `- ${item}`),
    more > 0 ? t('sync_manual_conflicts_more', { count: more }) : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
