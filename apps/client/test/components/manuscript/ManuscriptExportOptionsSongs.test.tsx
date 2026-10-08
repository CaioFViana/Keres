import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import ManuscriptExportOptions from '../../../src/components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import {
  defaultExportSettings,
  type ManuscriptExportSettings,
} from '../../../src/components/features/manuscript/export/manuscriptExportSettings';
import { songPrintOf } from '../../../src/components/features/manuscript/export/songPrintOf';

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

const FORMATS = ['docx', 'pdf', 'md', 'fountain', 'screenplay-pdf'] as const;

let latest: ManuscriptExportSettings | null = null;

function Harness({
  hasSongs,
  format,
  songs = false,
}: {
  hasSongs?: boolean;
  format?: 'fountain' | 'pdf';
  songs?: boolean;
}) {
  const [settings, setSettings] = useState(() => ({
    ...defaultExportSettings('Ana'),
    ...(format ? { format } : {}),
    includeSongs: songs,
  }));
  useEffect(() => {
    latest = settings;
  });
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
      hasSongs={hasSongs}
    />
  );
}

afterEach(() => {
  cleanup();
  latest = null;
});

describe('ManuscriptExportOptions songs', () => {
  it('offers to print the songs only where one is sung', async () => {
    const without = await render(<Harness />);
    expect(without.queryByTestId('export-songs')).toBeNull();
    await without.unmount();

    const view = await render(<Harness hasSongs />);
    expect(view.getByTestId('export-songs')).toBeTruthy();
    expect(view.getByText('export_songs_hint')).toBeTruthy();
  });

  it('prints none until the switch is turned on, and asks nothing more before', async () => {
    const view = await render(<Harness hasSongs />);
    expect(latest?.includeSongs).toBe(false);
    expect(view.queryByTestId('export-songs-placement-appendix')).toBeNull();

    await fireEvent(view.getByTestId('export-songs'), 'valueChange', true);

    expect(latest?.includeSongs).toBe(true);
    expect(view.getByTestId('export-songs-placement-appendix')).toBeTruthy();
    expect(view.getByTestId('export-songs-language-sung')).toBeTruthy();
  });

  it('chooses where, in which words and whether a part is printed again', async () => {
    const view = await render(<Harness hasSongs songs />);

    // The repeat only means something once a song is set in the scenes.
    expect(view.queryByTestId('export-songs-repeat-every')).toBeNull();
    await fireEvent.press(view.getByTestId('export-songs-placement-after-scene'));
    expect(latest?.songsPlacement).toBe('after-scene');
    await fireEvent.press(view.getByTestId('export-songs-repeat-every'));
    expect(latest?.songRepeat).toBe('every');
    await fireEvent.press(view.getByTestId('export-songs-language-both'));
    expect(latest?.songLanguage).toBe('both');
  });

  it('keeps the chords in the lines when asked', async () => {
    const view = await render(<Harness hasSongs songs />);

    await fireEvent(view.getByTestId('export-songs-chords'), 'valueChange', true);

    expect(latest?.songChords).toBe(true);
  });

  it('asks a script no placement and no chords: a song is set where it is sung', async () => {
    const view = await render(<Harness hasSongs songs format="fountain" />);

    expect(view.queryByTestId('export-songs-placement-appendix')).toBeNull();
    expect(view.queryByTestId('export-songs-chords')).toBeNull();
    expect(view.getByTestId('export-songs-language-sung')).toBeTruthy();
    expect(view.getByTestId('export-songs-repeat-first-only')).toBeTruthy();
  });
});

describe('songPrintOf', () => {
  const settings = { ...defaultExportSettings('Ana'), includeSongs: true };

  it('prints none unless the export asks for songs', () => {
    expect(songPrintOf({ ...settings, includeSongs: false }, 'Songs')).toBeUndefined();
  });

  it('carries the choices of the export and the heading', () => {
    const print = songPrintOf(
      { ...settings, songsPlacement: 'after-scene', songLanguage: 'both', songChords: true },
      'Canções',
    );

    expect(print).toMatchObject({
      placement: 'after-scene',
      language: 'both',
      repeat: 'first-only',
      chords: true,
      heading: 'Canções',
    });
  });

  it("sets a script's songs where they are sung, with no chords", () => {
    const print = songPrintOf({ ...settings, songChords: true }, 'Songs', true);

    expect(print).toMatchObject({ placement: 'after-scene', chords: false });
  });
});
