/** @jest-environment node */
import { useAppAlertStore } from '@/src/state/ui/appAlertStore';
import { AppAlert } from '@/src/state/ui/AppAlert';

beforeEach(() => {
  useAppAlertStore.setState({ current: null });
});

describe('AppAlert', () => {
  it('forwards alert calls to the app alert store', () => {
    const onDismiss = jest.fn();
    AppAlert.alert('Title', 'Message', [{ text: 'OK' }], { cancelable: false, onDismiss });
    expect(useAppAlertStore.getState().current).toMatchObject({
      title: 'Title',
      message: 'Message',
      buttons: [{ text: 'OK' }],
      cancelable: false,
      onDismiss,
    });
  });

  it('supports title-only alerts with default buttons', () => {
    AppAlert.alert('Hello');
    expect(useAppAlertStore.getState().current).toMatchObject({
      title: 'Hello',
      buttons: [{ text: 'OK' }],
      cancelable: true,
    });
  });
});
