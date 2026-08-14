/**
 * @jest-environment node
 */
import { useAppAlertStore } from '../../src/state/appAlertStore';

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

  /** Mesmo padrão do `Alert.alert` nativo: sem botões declarados, um "OK" que só fecha. */
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
