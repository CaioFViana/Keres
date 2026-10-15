/**
 * @jest-environment node
 */
import type { SyncConflict as SharedSyncConflict } from '@keres/shared';
import type { TFunction } from 'i18next';
import {
  MANUAL_SYNC_LISTED_REFUSALS,
  manualSyncRefusalText,
} from '@/src/services/sync/manualSyncMessage';

/** Keys come back as they are, with the values they were given, so the assertions can read them. */
const t = jest.fn((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key,
) as unknown as TFunction;

const refusal = (reason: string, overrides: Partial<SharedSyncConflict> = {}) =>
  ({
    clientOperationId: `op-${reason}`,
    entity: 'Chapter',
    entityId: 'chapter-1',
    type: 'update',
    reason,
    message: 'A technical message in English for the log.',
    ...overrides,
  }) as SharedSyncConflict;

describe('manualSyncRefusalText', () => {
  it('says nothing when every change of the save reached the server', () => {
    expect(manualSyncRefusalText({ conflicts: 0, refusals: [] }, t)).toBeUndefined();
  });

  it('names each refusal by its reason, never by the technical message', () => {
    const text = manualSyncRefusalText(
      { conflicts: 2, refusals: [refusal('unauthorized'), refusal('limit_exceeded')] },
      t,
    );

    expect(text).toContain('sync_manual_conflicts_intro');
    expect(text).toContain('conflict_reason_unauthorized');
    expect(text).toContain('conflict_reason_limit_exceeded');
    expect(text).not.toContain('technical message');
  });

  it('lists the first refusals and counts the rest', () => {
    const many = Array.from({ length: MANUAL_SYNC_LISTED_REFUSALS + 2 }, () =>
      refusal('unauthorized'),
    );

    const text = manualSyncRefusalText({ conflicts: many.length, refusals: many }, t);

    expect((text ?? '').split('conflict_reason_unauthorized').length - 1).toBe(
      MANUAL_SYNC_LISTED_REFUSALS,
    );
    expect(t).toHaveBeenCalledWith('sync_manual_conflicts_more', { count: 2 });
  });

  it('still reports a change the client could not send, when no refusal names it', () => {
    const text = manualSyncRefusalText({ conflicts: 1, refusals: [] }, t);

    expect(text).toContain('conflict_reason_unknown');
  });
});
