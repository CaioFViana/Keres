/**
 * @jest-environment jsdom
 */
import { Platform } from 'react-native';
import i18n from '@/src/utils/format/i18n';
import { syncDocumentLanguage } from '@/src/utils/format/i18n';

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

const originalOS = Platform.OS;

beforeEach(() => {
  document.documentElement.lang = 'en';
});

afterEach(async () => {
  setPlatform(originalOS);
  await i18n.changeLanguage('en');
});

describe('syncDocumentLanguage on web', () => {
  beforeEach(() => setPlatform('web'));

  it('writes the given language, short or full, into the page', () => {
    syncDocumentLanguage('pt');
    expect(document.documentElement.lang).toBe('pt');

    syncDocumentLanguage('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('leaves the page alone when there is no language to write', () => {
    syncDocumentLanguage('pt');
    syncDocumentLanguage(undefined);
    syncDocumentLanguage('');

    expect(document.documentElement.lang).toBe('pt');
  });

  it('sets the language when the interface loads, before any change', () => {
    document.documentElement.lang = 'xx';
    // A fresh copy of the module graph, so the module runs its start-up code again on web.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module graph needs require.
      const fresh = require('react-native') as typeof import('react-native');
      Object.defineProperty(fresh.Platform, 'OS', { value: 'web', configurable: true });
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module graph needs require.
      require('@/src/utils/format/i18n');
    });

    expect(document.documentElement.lang).toBe('en');
  });

  it('follows every language change of the interface, not only the first one', async () => {
    await i18n.changeLanguage('pt');
    expect(document.documentElement.lang).toBe('pt');

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe.each(['ios', 'android'])('on %s', (os) => {
  it('never touches the document, whatever the interface language does', async () => {
    setPlatform(os);
    document.documentElement.lang = 'en';

    await i18n.changeLanguage('pt');
    syncDocumentLanguage('pt');

    expect(document.documentElement.lang).toBe('en');
  });
});
