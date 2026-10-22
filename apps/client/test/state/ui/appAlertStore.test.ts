/**
 * @jest-environment node
 */
import { logger } from '@/src/utils/logging/logger';
import { pressAlertButton, useAppAlertStore } from '@/src/state/ui/appAlertStore';

const store = () => useAppAlertStore.getState();

beforeEach(() => {
  useAppAlertStore.setState({ current: null });
});

describe('show', () => {
  it('puts the alert on screen with its title and message', () => {
    store().show('Excluir?', 'Isto não pode ser desfeito.');

    expect(store().current).toMatchObject({
      title: 'Excluir?',
      message: 'Isto não pode ser desfeito.',
    });
  });

  /** The same behaviour as the native `Alert.alert`: with no buttons declared, an "OK" that only closes. */
  it('falls back to a single OK button when none were given', () => {
    store().show('Pronto');

    expect(store().current!.buttons).toEqual([{ text: 'OK' }]);
  });

  it('falls back to OK for an empty button list too', () => {
    store().show('Pronto', undefined, []);

    expect(store().current!.buttons).toEqual([{ text: 'OK' }]);
  });

  it('keeps the buttons the caller declared', () => {
    const onPress = jest.fn();
    store().show('Excluir?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress },
    ]);

    expect(store().current!.buttons).toHaveLength(2);
    expect(store().current!.buttons[1]).toMatchObject({ text: 'Excluir', style: 'destructive' });
  });

  it('is cancelable by default', () => {
    store().show('Pronto');

    expect(store().current!.cancelable).toBe(true);
  });

  it('honours a caller that forbids dismissing', () => {
    store().show('Obrigatório', undefined, undefined, { cancelable: false });

    expect(store().current!.cancelable).toBe(false);
  });

  it('replaces an alert already on screen', () => {
    store().show('Primeiro');

    store().show('Segundo');

    expect(store().current!.title).toBe('Segundo');
  });
});

describe('dismiss', () => {
  it('closes the alert', () => {
    store().show('Pronto');

    store().dismiss();

    expect(store().current).toBeNull();
  });

  it('runs the caller onDismiss hook', () => {
    const onDismiss = jest.fn();
    store().show('Pronto', undefined, undefined, { onDismiss });

    store().dismiss();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not press any button on the way out', () => {
    const onPress = jest.fn();
    store().show('Excluir?', undefined, [{ text: 'Excluir', onPress }]);

    store().dismiss();

    expect(onPress).not.toHaveBeenCalled();
  });

  it('is safe when there is no alert on screen', () => {
    expect(() => store().dismiss()).not.toThrow();
    expect(store().current).toBeNull();
  });

  it('does not run the previous hook again on a second dismiss', () => {
    const onDismiss = jest.fn();
    store().show('Pronto', undefined, undefined, { onDismiss });

    store().dismiss();
    store().dismiss();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('pressAlertButton', () => {
  it('runs the handler with the value', () => {
    const onPress = jest.fn();

    pressAlertButton({ text: 'OK', onPress }, 'typed');

    expect(onPress).toHaveBeenCalledWith('typed');
  });

  it('does nothing for a button without a handler', () => {
    expect(() => pressAlertButton({ text: 'OK' })).not.toThrow();
  });

  it('logs the rejection of an async handler instead of losing it', async () => {
    const failure = new Error('save failed');
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    pressAlertButton({ text: 'Save', onPress: () => Promise.reject(failure) });
    await Promise.resolve();
    await Promise.resolve();

    expect(logged).toHaveBeenCalledWith('An alert button failed:', failure);
    logged.mockRestore();
  });
});
