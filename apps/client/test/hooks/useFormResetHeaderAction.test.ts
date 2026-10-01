/** @jest-environment node */
import { act, renderHook } from '@testing-library/react-native';
import { useFormResetHeaderAction } from '../../src/hooks/useFormResetHeaderAction';

const mockAlert = jest.fn();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

beforeEach(() => {
  mockAlert.mockClear();
});

describe('useFormResetHeaderAction', () => {
  it('returns a disabled reset action when the form is pristine', async () => {
    const { result } = await renderHook(() =>
      useFormResetHeaderAction({ isEditing: false, isDirty: false, resetForm: jest.fn() }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: 'reset-form',
      icon: 'arrow-undo-outline',
      label: 'reset',
      disabled: true,
    });
  });

  it('confirms with the create copy and resets on confirm', async () => {
    const resetForm = jest.fn();
    const { result } = await renderHook(() =>
      useFormResetHeaderAction({ isEditing: false, isDirty: true, resetForm }),
    );
    expect(result.current[0].disabled).toBe(false);

    await act(() => {
      result.current[0].onPress();
    });
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    expect(title).toBe('form_reset_title');
    expect(message).toBe('form_reset_create_message');

    const confirm = buttons.find((button) => button.text === 'reset');
    await act(() => {
      confirm?.onPress?.();
    });
    expect(resetForm).toHaveBeenCalledTimes(1);
  });

  it('confirms with the edit copy and does nothing on cancel', async () => {
    const resetForm = jest.fn();
    const { result } = await renderHook(() =>
      useFormResetHeaderAction({ isEditing: true, isDirty: true, resetForm }),
    );

    await act(() => {
      result.current[0].onPress();
    });
    const [, message, buttons] = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => void }[],
    ];
    expect(message).toBe('form_reset_edit_message');
    expect(buttons.some((button) => button.style === 'cancel')).toBe(true);
    expect(resetForm).not.toHaveBeenCalled();
  });
});
