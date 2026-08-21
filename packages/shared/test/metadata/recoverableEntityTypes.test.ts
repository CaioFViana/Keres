import { describe, expect, it } from 'vitest';
import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { RECOVERABLE_ENTITY_TYPES } from '../../metadata/recoverableEntityTypes';

describe('RECOVERABLE_ENTITY_TYPES', () => {
  it('excludes User and OperationLog and includes sync soft-delete entities', () => {
    expect(RECOVERABLE_ENTITY_TYPES).not.toContain(OperationLogEntityType.User);
    expect(RECOVERABLE_ENTITY_TYPES).not.toContain(OperationLogEntityType.OperationLog);
    expect(RECOVERABLE_ENTITY_TYPES).toEqual([...RECOVERABLE_ENTITY_TYPES].sort());
    expect(RECOVERABLE_ENTITY_TYPES).toContain('Story');
    expect(RECOVERABLE_ENTITY_TYPES).toContain('ChoiceCheck');
    expect(RECOVERABLE_ENTITY_TYPES).toContain('Effect');
    expect(RECOVERABLE_ENTITY_TYPES).toContain('Comment');
  });
});
