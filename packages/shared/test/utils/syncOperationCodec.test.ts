import { describe, expect, it } from 'vitest';
import {
  decodePulledReorderOperation,
  encodeReorderOperationPayload,
} from '../../utils/syncOperationCodec';

describe('sync reorder operation codec', () => {
  it('preserves a stat target through operation-log encoding and pull decoding', () => {
    const payload = encodeReorderOperationPayload({
      type: 'reorder',
      entity: 'Story',
      id: 'story',
      reorderTarget: 'Stat',
      reorderItems: [{ id: 'stat', newIndex: 1 }],
    } as never);

    expect(payload).toEqual({
      reorderItems: [{ id: 'stat', newIndex: 1 }],
      reorderTarget: 'Stat',
    });
    expect(
      decodePulledReorderOperation('Story', payload, {
        id: 'story',
        version: 2,
        operationVersion: 3,
        operationTime: '2026-09-05T12:00:00.000Z',
        originatingUser: 'user',
        operationId: 'operation',
      }),
    ).toMatchObject({ entity: 'Story', reorderTarget: 'Stat', reorderItems: payload.reorderItems });
  });
});
