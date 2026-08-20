import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/launcher/i18n';
import { choiceMenuLines, runSetupWizard } from '../../src/launcher/wizard';
import type { LauncherIo } from '../../src/launcher/io';

describe('wizard choice menu', () => {
  it('lists options on their own lines and labels the default, not a trailing [1]', () => {
    const t = createTranslator('en');
    const lines = choiceMenuLines(t, t('language_title'), t('language_en'), t('language_pt'), '2');

    expect(lines).toEqual([
      'Language / Idioma',
      '  1. English',
      '  2. Português  (default — press Enter)',
    ]);
    expect(lines.join('\n')).not.toMatch(/\[1].*\[2].*\[1]/);
  });

  it('accepts Enter as the labelled default', async () => {
    const printed: string[] = [];
    const answers = ['', '', '', '', '', '', '', ''];
    const io: LauncherIo = {
      print: (message) => printed.push(message),
      prompt: async () => answers.shift() ?? '',
      isInteractive: () => true,
    };

    const result = await runSetupWizard({
      io,
      translateFor: createTranslator,
      existing: {
        language: 'pt',
        databaseDriver: 'sqlite',
        databaseUrl: 'file:./keres.db',
        mediaStorageDriver: 'local',
        host: '127.0.0.1',
        port: '3000',
        dataDir: '/tmp/keres-wizard',
        rootAdminUsername: 'root',
      },
    });

    expect(result.config.language).toBe('pt');
    expect(result.config.databaseDriver).toBe('sqlite');
    expect(result.config.host).toBe('127.0.0.1');
    expect(printed.some((line) => line.includes('(padrão — prima Enter)'))).toBe(true);
  });
});
