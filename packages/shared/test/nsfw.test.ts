import { describe, expect, it } from 'vitest';
import {
  AdminMessageListQuerySchema,
  AdminUpdateUserSchema,
  AdminUserListQuerySchema,
  buildNsfwReportBody,
  buildReportBody,
  parseReportBody,
  CreateStoryDataSchema,
  ownerOnlyFieldsIn,
  parseNsfwReportBody,
  StoryPublicationSnapshotSchema,
  StoryReportRequestSchema,
  STORY_OWNER_ONLY_FIELDS,
} from '../index';

describe('NSFW story flag', () => {
  it('defaults to a safe story and round-trips the flag', () => {
    expect(CreateStoryDataSchema.parse({ title: 'T', type: 'linear' }).isNsfw).toBe(false);
    expect(CreateStoryDataSchema.parse({ title: 'T', type: 'linear', isNsfw: true }).isNsfw).toBe(
      true,
    );
  });

  it('keeps the flag owner-only on both sides of sync', () => {
    expect(STORY_OWNER_ONLY_FIELDS).toContain('isNsfw');
    expect(ownerOnlyFieldsIn({ isNsfw: true })).toEqual(['isNsfw']);
    expect(ownerOnlyFieldsIn({ title: 'T' })).toEqual([]);
  });

  it('treats snapshots without the flag as safe (pre-flag publications)', () => {
    expect(
      StoryPublicationSnapshotSchema.parse({
        title: 'T',
        description: null,
        genre: null,
        language: null,
        author: null,
        type: 'linear',
        theme: null,
      }).isNsfw,
    ).toBe(false);
  });
});

describe('adult verification (admin-managed)', () => {
  it('accepts the verification toggle on update and defaults new accounts to unverified', () => {
    expect(AdminUpdateUserSchema.parse({ isAdultVerified: true })).toEqual({
      isAdultVerified: true,
    });
    expect(AdminUpdateUserSchema.parse({})).toEqual({});
  });

  it('filters the user list by verification', () => {
    expect(AdminUserListQuerySchema.parse({ adultVerified: 'true' }).adultVerified).toBe(true);
    expect(AdminUserListQuerySchema.parse({}).adultVerified).toBeUndefined();
  });
});

describe('story report envelope', () => {
  it('builds a machine-readable body the inbox can filter on', () => {
    const body = buildNsfwReportBody('story01', 'spam links');
    expect(body).toBe('[NSFW-REPORT story:story01] spam links');
    expect(parseNsfwReportBody(body)).toEqual({ storyId: 'story01', reason: 'spam links' });
  });

  it('leaves ordinary messages alone', () => {
    expect(parseNsfwReportBody('hello admin')).toBeNull();
    expect(parseNsfwReportBody('[NSFW-REPORT story:] x')).toBeNull();
  });

  it('accepts the report source and a reason-only request', () => {
    expect(AdminMessageListQuerySchema.parse({ source: 'report' }).source).toBe('report');
    expect(StoryReportRequestSchema.parse({ reason: '  rude  ' })).toEqual({
      type: 'other',
      reason: 'rude',
    });
    expect(StoryReportRequestSchema.safeParse({ reason: '  ' }).success).toBe(false);
  });

  it('round-trips a typed report for every target', () => {
    for (const target of ['story', 'user', 'message', 'publication'] as const) {
      const body = buildReportBody('intimate', target, 'id01', 'please remove');
      expect(body).toBe('[REPORT type:intimate ' + target + ':id01] please remove');
      expect(parseReportBody(body)).toEqual({
        type: 'intimate',
        targetKind: target,
        targetId: 'id01',
        reason: 'please remove',
      });
    }
  });

  it('reads a legacy envelope as an untyped story report', () => {
    expect(parseReportBody('[NSFW-REPORT story:story01] spam links')).toEqual({
      type: 'other',
      targetKind: 'story',
      targetId: 'story01',
      reason: 'spam links',
    });
    expect(parseReportBody('hello admin')).toBeNull();
    expect(parseReportBody('[REPORT type:nope story:x] y')).toBeNull();
  });
});
