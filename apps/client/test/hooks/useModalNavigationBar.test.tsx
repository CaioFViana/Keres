import { renderHook } from '@testing-library/react-native';
import { useModalNavigationBar } from '@/src/hooks/ui/useModalNavigationBar';
import { applyNavigationBarStyle } from '@/src/utils/platform/navigationBarStyle';

const mockColors = { background: '#000000' };
jest.mock('@/src/theme', () => ({ useTheme: () => ({ colors: mockColors }) }));
jest.mock('@/src/utils/platform/navigationBarStyle', () => ({
  __esModule: true,
  applyNavigationBarStyle: jest.fn(),
}));

describe('useModalNavigationBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockColors.background = '#000000';
  });
  afterEach(() => jest.useRealTimers());

  it('does nothing while the modal is closed', async () => {
    await renderHook(() => useModalNavigationBar(false));
    jest.advanceTimersByTime(1000);

    expect(applyNavigationBarStyle).not.toHaveBeenCalled();
  });

  it('tints the buttons light on a dark palette once the modal is up, and again after its animation', async () => {
    await renderHook(() => useModalNavigationBar(true));
    jest.advanceTimersByTime(1000);

    expect(applyNavigationBarStyle).toHaveBeenCalledTimes(3);
    expect(applyNavigationBarStyle).toHaveBeenLastCalledWith('light');
  });

  it('tints them dark on a light palette', async () => {
    mockColors.background = '#ffffff';
    await renderHook(() => useModalNavigationBar(true));
    jest.advanceTimersByTime(1000);

    expect(applyNavigationBarStyle).toHaveBeenLastCalledWith('dark');
  });

  it('stops when the modal closes before the last settle', async () => {
    const view = await renderHook(() => useModalNavigationBar(true));
    jest.advanceTimersByTime(10);
    await view.unmount();
    jest.advanceTimersByTime(1000);

    expect(applyNavigationBarStyle).toHaveBeenCalledTimes(1);
  });
});
