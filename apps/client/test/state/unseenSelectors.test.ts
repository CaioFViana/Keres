jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { act, renderHook } from '@testing-library/react-native';
import {
  useHasUnseenAdminMessages,
  useHasUnseenMessages,
  useIsConversationUnseen,
  useUnseenMessagesStore,
} from '../../src/state/unseenMessagesStore';

const setUnseen = (unseen: Record<string, string>) =>
  act(async () => {
    useUnseenMessagesStore.setState({ unseen });
  });

beforeEach(() => {
  useUnseenMessagesStore.getState().reset();
});

describe('useIsConversationUnseen', () => {
  it('follows one conversation, and only that one', async () => {
    const { result } = await renderHook(() => useIsConversationUnseen('srv-1|u1'));
    expect(result.current).toBe(false);

    await setUnseen({ 'srv-1|u2': '09', 'srv-2|u1': '09' });
    expect(result.current).toBe(false);

    await setUnseen({ 'srv-1|u1': '09' });
    expect(result.current).toBe(true);

    await setUnseen({});
    expect(result.current).toBe(false);
  });

  it('never matches an empty key: a screen that has no friend yet is not marked', async () => {
    await setUnseen({ 'srv-1|u1': '09' });

    const { result } = await renderHook(() => useIsConversationUnseen(''));

    expect(result.current).toBe(false);
  });
});

describe('useHasUnseenAdminMessages', () => {
  it('is true only for the administrators of a server, not for friends', async () => {
    const { result } = await renderHook(() => useHasUnseenAdminMessages());

    await setUnseen({ 'srv-1|u1': '09' });
    expect(result.current).toBe(false);

    await setUnseen({ 'srv-1|u1': '09', 'srv-2|admin': '05' });
    expect(result.current).toBe(true);
  });

  it('does not take a friend whose id ends in admin for the administrators', async () => {
    await setUnseen({ 'srv-1|u1-admin': '09' });

    const { result } = await renderHook(() => useHasUnseenAdminMessages());

    // `u1-admin` ends in "admin" but not in "|admin".
    expect(result.current).toBe(false);
  });

  it('leaves the any-message selector as it was', async () => {
    await setUnseen({ 'srv-1|u1': '09' });

    const { result } = await renderHook(() => useHasUnseenMessages());

    expect(result.current).toBe(true);
  });
});
