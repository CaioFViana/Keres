/** @jest-environment node */
import { SYNC_ACCOUNT_NOTICE_ID, shouldShowSyncNotice } from '@/src/guides/shouldShowSyncNotice';

const open = {
  serverless: false,
  serverCount: 0,
  seen: [] as string[],
  showTutorials: true,
  isShowcase: false,
};

describe('shouldShowSyncNotice', () => {
  it('has a stable id, the one the seen history keeps', () => {
    expect(SYNC_ACCOUNT_NOTICE_ID).toBe('sync-account-prompt');
  });

  it('shows for a device with no server that has never been told', () => {
    expect(shouldShowSyncNotice(open)).toBe(true);
  });

  it('stays quiet in the serverless browser build, where there is no account to offer', () => {
    expect(shouldShowSyncNotice({ ...open, serverless: true })).toBe(false);
  });

  it('stays quiet during a showcase capture', () => {
    expect(shouldShowSyncNotice({ ...open, isShowcase: true })).toBe(false);
  });

  it('stays quiet when the tutorials are switched off', () => {
    expect(shouldShowSyncNotice({ ...open, showTutorials: false })).toBe(false);
  });

  it('stays quiet until the servers have been read', () => {
    expect(shouldShowSyncNotice({ ...open, serverCount: null })).toBe(false);
  });

  it('stays quiet for a device that already has a server', () => {
    expect(shouldShowSyncNotice({ ...open, serverCount: 1 })).toBe(false);
    expect(shouldShowSyncNotice({ ...open, serverCount: 3 })).toBe(false);
  });

  it('stays quiet once the notice was seen', () => {
    expect(shouldShowSyncNotice({ ...open, seen: [SYNC_ACCOUNT_NOTICE_ID] })).toBe(false);
  });

  it('is not put off by other seen screens', () => {
    expect(shouldShowSyncNotice({ ...open, seen: ['StorySelectionMain', 'BoardCanvas'] })).toBe(
      true,
    );
  });

  it('stays quiet when several conditions hold at once', () => {
    expect(
      shouldShowSyncNotice({
        serverless: true,
        serverCount: 2,
        seen: [SYNC_ACCOUNT_NOTICE_ID],
        showTutorials: false,
        isShowcase: true,
      }),
    ).toBe(false);
  });
});
