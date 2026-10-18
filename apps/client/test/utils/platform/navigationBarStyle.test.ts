import { Platform } from 'react-native';
import { applyNavigationBarStyle } from '@/src/utils/platform/navigationBarStyle';

const mockSetStyle = jest.fn();
jest.mock('expo', () => ({
  requireNativeModule: () => ({ setStyle: (style: string) => mockSetStyle(style) }),
}));

describe('applyNavigationBarStyle', () => {
  const original = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: original });
    mockSetStyle.mockReset();
  });

  it('asks the native module straight, on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });

    applyNavigationBarStyle('light');

    expect(mockSetStyle).toHaveBeenCalledWith('light');
  });

  it('leaves other platforms alone', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });

    applyNavigationBarStyle('dark');

    expect(mockSetStyle).not.toHaveBeenCalled();
  });

  it('never throws when the native side fails', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    mockSetStyle.mockImplementation(() => {
      throw new Error('no module');
    });

    expect(() => applyNavigationBarStyle('dark')).not.toThrow();
  });
});
