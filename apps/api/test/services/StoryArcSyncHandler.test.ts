import { describe, expect, it } from 'vitest';
import { StoryArcSyncHandler } from '../../src/services/entity-sync-handlers/StoryArcSyncHandler';

describe('StoryArcSyncHandler', () => {
  it('registers the StoryArc protocol entity', () => {
    expect(new StoryArcSyncHandler().entityName).toBe('StoryArc');
  });
});
