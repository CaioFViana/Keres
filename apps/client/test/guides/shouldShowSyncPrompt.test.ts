/** @jest-environment node */
import { SYNC_ACCOUNT_PROMPT_ID, shouldShowSyncPrompt } from '@/src/guides/shouldShowSyncPrompt';

const open = {
  serverless: false,
  serverCount: 0,
  seen: [] as string[],
  showTutorials: true,
  hasActiveTour: false,
  tourPending: false,
  isShowcase: false,
};

describe('shouldShowSyncPrompt', () => {
  it('has a stable id, the one the seen history keeps', () => {
    expect(SYNC_ACCOUNT_PROMPT_ID).toBe('sync-account-prompt');
  });

  it('opens for a device with no server that has never been told', () => {
    expect(shouldShowSyncPrompt(open)).toBe(true);
  });

  it('stays quiet in the serverless browser build, where there is no account to offer', () => {
    expect(shouldShowSyncPrompt({ ...open, serverless: true })).toBe(false);
  });

  it('stays quiet during a showcase capture', () => {
    expect(shouldShowSyncPrompt({ ...open, isShowcase: true })).toBe(false);
  });

  it('stays quiet when the tutorials are switched off', () => {
    expect(shouldShowSyncPrompt({ ...open, showTutorials: false })).toBe(false);
  });

  it('stays quiet while a tour is playing', () => {
    expect(shouldShowSyncPrompt({ ...open, hasActiveTour: true })).toBe(false);
  });

  it('waits for the screen tour that is still to come', () => {
    expect(shouldShowSyncPrompt({ ...open, tourPending: true })).toBe(false);
  });

  it('stays quiet until the servers have been read', () => {
    expect(shouldShowSyncPrompt({ ...open, serverCount: null })).toBe(false);
  });

  it('stays quiet for a device that already has a server', () => {
    expect(shouldShowSyncPrompt({ ...open, serverCount: 1 })).toBe(false);
    expect(shouldShowSyncPrompt({ ...open, serverCount: 3 })).toBe(false);
  });

  it('stays quiet once the notice was seen', () => {
    expect(shouldShowSyncPrompt({ ...open, seen: [SYNC_ACCOUNT_PROMPT_ID] })).toBe(false);
  });

  it('is not put off by other seen screens', () => {
    expect(shouldShowSyncPrompt({ ...open, seen: ['StorySelectionMain', 'BoardCanvas'] })).toBe(
      true,
    );
  });

  it('stays quiet when several conditions hold at once', () => {
    expect(
      shouldShowSyncPrompt({
        serverless: true,
        serverCount: 2,
        seen: [SYNC_ACCOUNT_PROMPT_ID],
        showTutorials: false,
        hasActiveTour: true,
        tourPending: true,
        isShowcase: true,
      }),
    ).toBe(false);
  });
});
