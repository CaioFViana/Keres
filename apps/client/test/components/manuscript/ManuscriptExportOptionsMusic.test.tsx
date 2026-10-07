import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import ManuscriptExportOptions from '../../../src/components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import {
  defaultExportSettings,
  type ManuscriptExportSettings,
} from '../../../src/components/features/manuscript/export/manuscriptExportSettings';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      surface: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ccf',
      onPrimary: '#fff',
      shadow: '#000',
      background: '#fff',
      error: '#f00',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

const FORMATS = ['docx', 'pdf', 'epub', 'html', 'md', 'txt', 'fountain', 'screenplay-pdf'] as const;

let latest: ManuscriptExportSettings | null = null;

function Harness({ hasMusic, format }: { hasMusic?: boolean; format?: 'fountain' | 'pdf' }) {
  const [settings, setSettings] = useState(() => ({
    ...defaultExportSettings('Ana'),
    ...(format ? { format } : {}),
  }));
  latest = settings;
  return (
    <ManuscriptExportOptions
      settings={settings}
      onChange={setSettings}
      formats={FORMATS}
      branching={false}
      showLooseSwitch
      looseCount={2}
      chapterNumberingAvailable
      arcs={[]}
      hasMusic={hasMusic}
    />
  );
}

afterEach(() => {
  cleanup();
  latest = null;
});

describe('ManuscriptExportOptions music', () => {
  it('offers to write the music of each scene only when the story has some', async () => {
    const without = await render(<Harness />);
    expect(without.queryByTestId('export-music')).toBeNull();
    await without.unmount();

    const view = await render(<Harness hasMusic />);
    expect(view.getByTestId('export-music')).toBeTruthy();
  });

  it('writes the music of each scene when the switch is turned on, and not before', async () => {
    const view = await render(<Harness hasMusic />);
    expect(latest?.includeMusicCues).toBe(false);

    await fireEvent(view.getByTestId('export-music'), 'valueChange', true);

    expect(latest?.includeMusicCues).toBe(true);
    expect(latest?.preset).toBe('custom');
  });

  it('asks it as notes for a screenplay', async () => {
    const view = await render(<Harness hasMusic format="fountain" />);

    expect(view.getByTestId('export-music')).toBeTruthy();
    expect(view.getByText('export_screenplay_music_notes_hint')).toBeTruthy();
    expect(view.queryByText('export_manuscript_include_music')).toBeNull();
  });
});
