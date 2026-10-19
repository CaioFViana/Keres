import { describe, expect, it } from 'vitest';
import {
  ADMIN_MESSAGES_PER_DAY,
  AdminMessageListQuerySchema,
  AdminMessagePatchSchema,
  MESSAGE_BODY_MAX_LENGTH,
  MessagePageQuerySchema,
  MessageSendSchema,
  TierCreateInputSchema,
} from '../../index';

describe('MessageSendSchema', () => {
  it('trims, and refuses empty and over-long messages', () => {
    expect(MessageSendSchema.parse({ body: '  hello  ' })).toEqual({ body: 'hello' });
    expect(MessageSendSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(MessageSendSchema.safeParse({ body: 'x'.repeat(MESSAGE_BODY_MAX_LENGTH) }).success).toBe(
      true,
    );
    expect(
      MessageSendSchema.safeParse({ body: 'x'.repeat(MESSAGE_BODY_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('MessagePageQuerySchema', () => {
  it('defaults the page size and caps it', () => {
    expect(MessagePageQuerySchema.parse({})).toEqual({ limit: 30 });
    expect(MessagePageQuerySchema.parse({ limit: '10', before: 'abc' })).toEqual({
      limit: 10,
      before: 'abc',
    });
    expect(MessagePageQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(MessagePageQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});

describe('AdminMessageListQuerySchema', () => {
  it('shows the active inbox, newest first, when nothing is asked', () => {
    expect(AdminMessageListQuerySchema.parse({})).toEqual({
      source: 'all',
      read: 'all',
      archived: 'active',
      sort: 'date',
      order: 'desc',
      page: 1,
      pageSize: 25,
    });
  });

  it('takes every filter, and refuses values outside them', () => {
    expect(
      AdminMessageListQuerySchema.parse({
        source: 'site',
        read: 'unread',
        archived: 'all',
        sort: 'sender',
        order: 'asc',
        page: '2',
        pageSize: '50',
        search: '  plans ',
      }),
    ).toMatchObject({
      source: 'site',
      read: 'unread',
      archived: 'all',
      sort: 'sender',
      order: 'asc',
      page: 2,
      pageSize: 50,
      search: 'plans',
    });
    for (const bad of [
      { source: 'moon' },
      { read: 'maybe' },
      { archived: 'no' },
      { sort: 'size' },
      { order: 'up' },
      { page: 0 },
      { pageSize: 101 },
    ]) {
      expect(AdminMessageListQuerySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('AdminMessagePatchSchema', () => {
  it('needs at least one change', () => {
    expect(AdminMessagePatchSchema.parse({ read: false })).toEqual({ read: false });
    expect(AdminMessagePatchSchema.parse({ archived: true })).toEqual({ archived: true });
    expect(AdminMessagePatchSchema.safeParse({}).success).toBe(false);
  });
});

describe('the messaging limits', () => {
  it('gives the administrators a fixed ceiling, and tiers a nullable one where zero silences', () => {
    expect(ADMIN_MESSAGES_PER_DAY).toBeGreaterThan(0);
    expect(TierCreateInputSchema.parse({ name: 'T', maxMessagesPerDay: 0 }).maxMessagesPerDay).toBe(
      0,
    );
    expect(
      TierCreateInputSchema.parse({ name: 'T', maxMessagesPerDay: null }).maxMessagesPerDay,
    ).toBeNull();
    expect(TierCreateInputSchema.safeParse({ name: 'T', maxMessagesPerDay: -1 }).success).toBe(
      false,
    );
    expect(TierCreateInputSchema.safeParse({ name: 'T', maxMessagesPerDay: 1.5 }).success).toBe(
      false,
    );
  });
});
