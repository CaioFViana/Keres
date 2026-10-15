const mockGetOwnPlan = jest.fn();
jest.mock('@/src/services/UserApiService', () => ({
  userApiService: { getOwnPlan: (...args: unknown[]) => mockGetOwnPlan(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAccountPlan } from '@/src/hooks/useAccountPlan';
import { PAYMENTS_CHANGED } from '@/src/utils/paymentEvents';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

const server = { id: 'server-1', name: 'Home', url: 'https://keres.test' } as never;
const planNamed = (tierName: string) => ({ tierName, isDefault: false, storiesUsed: 1 });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOwnPlan.mockResolvedValue(planNamed('Free'));
});

describe('useAccountPlan', () => {
  it('reads the plan once the server answers', async () => {
    const { result } = await renderHook(() => useAccountPlan(server, true));

    await waitFor(() => expect(result.current.plan).toMatchObject({ tierName: 'Free' }));
    expect(mockGetOwnPlan).toHaveBeenCalledWith(server);
  });

  it('does not ask while the server is offline, and shows nothing', async () => {
    const { result } = await renderHook(() => useAccountPlan(server, false));

    expect(mockGetOwnPlan).not.toHaveBeenCalled();
    expect(result.current.plan).toBeNull();
  });

  it('shows nothing from a server that cannot say, or is older than the route', async () => {
    mockGetOwnPlan.mockResolvedValue(null);
    const { result } = await renderHook(() => useAccountPlan(server, true));

    await waitFor(() => expect(mockGetOwnPlan).toHaveBeenCalled());
    expect(result.current.plan).toBeNull();
  });

  it('shows nothing when the server fails', async () => {
    mockGetOwnPlan.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useAccountPlan(server, true));

    await waitFor(() => expect(mockGetOwnPlan).toHaveBeenCalled());
    expect(result.current.plan).toBeNull();
  });

  it('reads the plan again when a payment of this server changes, and not for another', async () => {
    const { result } = await renderHook(() => useAccountPlan(server, true));
    await waitFor(() => expect(result.current.plan).toMatchObject({ tierName: 'Free' }));

    mockGetOwnPlan.mockResolvedValue(planNamed('Pro'));
    await act(async () => entityEventEmitter.emit(PAYMENTS_CHANGED, 'other-server'));
    expect(result.current.plan).toMatchObject({ tierName: 'Free' });

    await act(async () => entityEventEmitter.emit(PAYMENTS_CHANGED, 'server-1'));
    await waitFor(() => expect(result.current.plan).toMatchObject({ tierName: 'Pro' }));
  });
});
