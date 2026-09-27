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

const ALL_FORMATS = ['docx', 'pdf', 'epub', 'html', 'md', 'txt'] as const;

let latest: ManuscriptExportSettings | null = null;

function Harness({
  formats = ALL_FORMATS,
  arcs = [],
  showLooseSwitch = true,
  chapterNumberingAvailable = true,
  routeName = null,
}: {
  formats?: readonly (typeof ALL_FORMATS)[number][];
  arcs?: { id: string; title: string }[];
  showLooseSwitch?: boolean;
  chapterNumberingAvailable?: boolean;
  routeName?: string | null;
}) {
  const [settings, setSettings] = useState(() => defaultExportSettings('Ana'));
  latest = settings;
  return (
    <ManuscriptExportOptions
      settings={settings}
      onChange={setSettings}
      formats={formats}
      routeName={routeName}
      showLooseSwitch={showLooseSwitch}
      looseCount={2}
      chapterNumberingAvailable={chapterNumberingAvailable}
      arcs={arcs}
    />
  );
}

afterEach(() => {
  cleanup();
  latest = null;
});

describe('ManuscriptExportOptions', () => {
  it('fills everything from a preset, and any change by hand makes it custom', async () => {
    const view = await render(<Harness />);

    await fireEvent.press(view.getByTestId('export-preset-paperback'));
    expect(latest).toMatchObject({ preset: 'paperback', format: 'pdf' });
    expect(latest?.style.pageSize).toBe('6x9');

    await fireEvent.press(view.getByTestId('export-quotes-guillemets'));
    expect(latest).toMatchObject({ preset: 'custom', format: 'pdf' });
    expect(latest?.style).toMatchObject({ pageSize: '6x9', quotes: 'guillemets' });
  });

  it('only offers presets whose format the destination has', async () => {
    const view = await render(<Harness formats={['docx', 'md']} />);

    expect(view.getByTestId('export-preset-submission')).toBeTruthy();
    expect(view.queryByTestId('export-preset-ebook')).toBeNull();
    expect(view.queryByTestId('export-preset-paperback')).toBeNull();
    expect(view.queryByTestId('export-format-pdf')).toBeNull();
  });

  it('shows only the layout a format can honor', async () => {
    const view = await render(<Harness />);

    // docx: face and body, no pages.
    expect(view.getByTestId('export-font-serif')).toBeTruthy();
    expect(view.getByTestId('export-size-12')).toBeTruthy();
    expect(view.queryByTestId('export-page-a4')).toBeNull();

    await fireEvent.press(view.getByTestId('export-format-pdf'));
    expect(view.getByTestId('export-page-6x9')).toBeTruthy();
    expect(view.queryByTestId('export-font-serif')).toBeNull();

    await fireEvent.press(view.getByTestId('export-format-txt'));
    expect(view.queryByTestId('export-size-12')).toBeNull();
    expect(view.queryByTestId('export-index')).toBeNull();
    // Text options apply to every format.
    expect(view.getByTestId('export-separator-asterisks')).toBeTruthy();
  });

  it('asks the author for a title page and for an EPUB', async () => {
    const view = await render(<Harness />);
    expect(view.queryByTestId('export-author')).toBeNull();

    await fireEvent(view.getByTestId('export-title-page'), 'valueChange', true);
    expect(view.getByTestId('export-author').props.value).toBe('Ana');
    await fireEvent.changeText(view.getByTestId('export-author'), 'Bia');
    expect(latest).toMatchObject({ titlePage: true, author: 'Bia' });

    await fireEvent(view.getByTestId('export-title-page'), 'valueChange', false);
    expect(view.queryByTestId('export-author')).toBeNull();
    await fireEvent.press(view.getByTestId('export-format-epub'));
    expect(view.getByTestId('export-author')).toBeTruthy();
  });

  it('clears a size back to the format default', async () => {
    const view = await render(<Harness />);

    await fireEvent.press(view.getByTestId('export-size-14'));
    expect(latest?.style.fontSize).toBe(14);
    await fireEvent.press(view.getByTestId('export-size-0'));
    expect(latest?.style.fontSize).toBeUndefined();
  });

  it('restarts numbers only with scene names on a linear story', async () => {
    const view = await render(<Harness />);
    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent(view.getByTestId('export-scene-names'), 'valueChange', true);
    expect(view.getByTestId('export-reset-numbers')).toBeTruthy();
  });

  it('never restarts numbers on a route', async () => {
    const branching = await render(<Harness chapterNumberingAvailable={false} />);
    await fireEvent(branching.getByTestId('export-scene-names'), 'valueChange', true);
    expect(branching.queryByTestId('export-reset-numbers')).toBeNull();
  });

  it('hides the arc selector for a single arc', async () => {
    const single = await render(<Harness arcs={[{ id: 'arc-1', title: 'Only' }]} />);
    expect(single.queryByTestId('export-arc-all')).toBeNull();
  });

  it('picks one arc or all of them', async () => {
    const view = await render(
      <Harness
        arcs={[
          { id: 'arc-1', title: 'First Arc' },
          { id: 'arc-2', title: 'Second Arc' },
        ]}
      />,
    );
    await fireEvent.press(view.getByTestId('export-arc-arc-2'));
    expect(latest?.arcId).toBe('arc-2');
    await fireEvent.press(view.getByTestId('export-arc-all'));
    expect(latest?.arcId).toBeNull();
  });

  it('notes the route and hides the loose switch when asked', async () => {
    const view = await render(<Harness routeName="Main" showLooseSwitch={false} />);

    expect(view.getByText('export_manuscript_route_note:{"route":"Main"}')).toBeTruthy();
    expect(view.queryByTestId('export-loose')).toBeNull();
  });
});
