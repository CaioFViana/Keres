/**
 * @jest-environment jsdom
 */
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

import { useFocusEffect } from '@react-navigation/native';
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { setDocumentTitle, useDocumentTitle } from '../../src/utils/documentTitle';

const useFocusEffectMock = useFocusEffect as jest.Mock;

/**
 * O título da aba é o que distingue várias janelas do Keres abertas ao mesmo tempo, e no
 * nativo `document` simplesmente não existe - chamar isto lá tem que ser inofensivo.
 */
const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

const originalOS = Platform.OS;

afterEach(() => {
  setPlatform(originalOS);
  jest.clearAllMocks();
});

describe('on web', () => {
  beforeEach(() => setPlatform('web'));

  it('prefixes the screen name with the app name', () => {
    setDocumentTitle('Personagem - Keres');

    expect(document.title).toBe('Keres: Personagem - Keres');
  });

  it('falls back to the bare app name when there is no screen name', () => {
    setDocumentTitle('');

    expect(document.title).toBe('Keres');
  });

  it('replaces the previous title instead of appending to it', () => {
    setDocumentTitle('Primeira');
    setDocumentTitle('Segunda');

    expect(document.title).toBe('Keres: Segunda');
  });
});

describe.each(['ios', 'android'])('on %s', (os) => {
  it('does nothing, since there is no document to touch', () => {
    setPlatform('web');
    setDocumentTitle('Antes');
    setPlatform(os);

    expect(() => setDocumentTitle('Depois')).not.toThrow();
    expect(document.title).toBe('Keres: Antes');
  });
});

describe('useDocumentTitle', () => {
  beforeEach(() => setPlatform('web'));

  it('updates the browser title only when the focused screen callback runs', async () => {
    const focusCallbacks: (() => void)[] = [];
    useFocusEffectMock.mockImplementation((callback) => focusCallbacks.push(callback));

    const hook = await renderHook<void, { title: string }>(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Personagens' },
    });
    expect(document.title).not.toBe('Keres: Personagens');

    focusCallbacks[0]();
    expect(document.title).toBe('Keres: Personagens');

    await hook.rerender({ title: 'Cenas' });
    focusCallbacks[1]();
    expect(document.title).toBe('Keres: Cenas');
  });
});
