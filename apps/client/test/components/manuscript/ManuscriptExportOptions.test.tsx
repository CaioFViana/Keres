import { assessManuscriptSize, screenplayGeometry, screenplayPreset } from '@keres/shared';
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
  branching = false,
}: {
  formats?: readonly (typeof ALL_FORMATS)[number][];
  arcs?: { id: string; title: string }[];
  showLooseSwitch?: boolean;
  chapterNumberingAvailable?: boolean;
  branching?: boolean;
}) {
  const [settings, setSettings] = useState(() => defaultExportSettings('Ana'));
  latest = settings;
  return (
    <ManuscriptExportOptions
      settings={settings}
      onChange={setSettings}
      formats={formats}
      branching={branching}
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

const SCRIPT_FORMATS = [...ALL_FORMATS, 'fountain', 'screenplay-pdf'] as const;

function ScriptHarness({
  estimate = null,
}: {
  estimate?: Parameters<typeof ManuscriptExportOptions>[0]['screenplayEstimate'];
}) {
  const [settings, setSettings] = useState(() => defaultExportSettings('Ana'));
  latest = settings;
  return (
    <ManuscriptExportOptions
      settings={settings}
      onChange={setSettings}
      formats={SCRIPT_FORMATS}
      branching={false}
      showLooseSwitch
      looseCount={2}
      chapterNumberingAvailable
      arcs={[]}
      screenplayEstimate={estimate}
    />
  );
}

describe('ManuscriptExportOptions size', () => {
  const assess = (bytes: number) => assessManuscriptSize(bytes, 100 * 1024 * 1024);

  function SizeHarness({ size }: { size: ReturnType<typeof assessManuscriptSize> | null }) {
    const [settings, setSettings] = useState(() => defaultExportSettings('Ana'));
    return (
      <ManuscriptExportOptions
        settings={settings}
        onChange={setSettings}
        formats={ALL_FORMATS}
        branching={false}
        showLooseSwitch
        looseCount={2}
        chapterNumberingAvailable
        arcs={[]}
        sizeEstimate={size}
      />
    );
  }

  it('says how big the file will be, and warns as it nears and passes the limit', async () => {
    const ok = await render(<SizeHarness size={assess(5 * 1024 * 1024)} />);
    expect(ok.getByTestId('export-size-ok').props.children).toContain('export_size_ok');
    expect(ok.getByTestId('export-size-ok').props.children).toContain('5.0 MB');
    await ok.unmount();

    const near = await render(<SizeHarness size={assess(90 * 1024 * 1024)} />);
    expect(near.getByTestId('export-size-near')).toBeTruthy();
    await near.unmount();

    const over = await render(<SizeHarness size={assess(120 * 1024 * 1024)} />);
    expect(over.getByTestId('export-size-over')).toBeTruthy();
  });

  it('shows no figure for what is too small to count, and nothing without an estimate', async () => {
    const tiny = await render(<SizeHarness size={assess(2048)} />);
    expect(tiny.getByTestId('export-size-ok').props.children).toContain('< 0.1 MB');
    await tiny.unmount();

    const none = await render(<SizeHarness size={null} />);
    expect(none.queryByTestId('export-size-ok')).toBeNull();
  });
});

describe('ManuscriptExportOptions for a screenplay', () => {
  it('offers the screenplay formats and swaps the book choices for the screenplay ones', async () => {
    const view = await render(<ScriptHarness />);
    expect(view.getByTestId('export-format-fountain')).toBeTruthy();
    expect(view.getByTestId('export-format-screenplay-pdf')).toBeTruthy();
    expect(view.queryByTestId('export-screenplay-paper-letter')).toBeNull();
    expect(view.getByTestId('export-scene-names')).toBeTruthy();

    await fireEvent.press(view.getByTestId('export-format-screenplay-pdf'));

    expect(latest?.format).toBe('screenplay-pdf');
    expect(view.getByTestId('export-screenplay-paper-letter')).toBeTruthy();
    expect(view.getByTestId('export-screenplay-numbers')).toBeTruthy();
    expect(view.getByTestId('export-screenplay-headings')).toBeTruthy();
    expect(view.getByTestId('export-author')).toBeTruthy();
    // The book's own choices mean nothing to a script and are not asked.
    expect(view.queryByTestId('export-scene-names')).toBeNull();
    expect(view.queryByTestId('export-quotes-curly')).toBeNull();
    expect(view.queryByTestId('export-preset-ebook')).toBeNull();
  });

  it('changes the paper, the numbering and the headings, one at a time', async () => {
    const view = await render(<ScriptHarness />);
    await fireEvent.press(view.getByTestId('export-format-fountain'));

    await fireEvent.press(view.getByTestId('export-screenplay-paper-a4'));
    expect(latest?.screenplay.paper).toBe('a4');
    await fireEvent(view.getByTestId('export-screenplay-numbers'), 'valueChange', true);
    expect(latest?.screenplay.numberScenes).toBe(true);
    await fireEvent(view.getByTestId('export-screenplay-headings'), 'valueChange', false);
    expect(latest?.screenplay).toEqual({
      paper: 'a4',
      numberScenes: true,
      generateHeadings: false,
    });
  });

  it('shows the estimate beside the numbers it stands on', async () => {
    const estimate = {
      pages: 12,
      eighths: 12 * 8 - 3,
      preset: screenplayPreset('letter'),
      geometry: screenplayGeometry(screenplayPreset('letter')),
    };
    const view = await render(<ScriptHarness estimate={estimate} />);
    await fireEvent.press(view.getByTestId('export-format-fountain'));

    expect(view.getByTestId('screenplay-estimate-pages')).toBeTruthy();
    expect(view.getByTestId('screenplay-estimate-how').props.children).toContain('Courier');
  });

  it('shows no estimate for a book format', async () => {
    const view = await render(<ScriptHarness estimate={null} />);

    expect(view.queryByTestId('screenplay-estimate')).toBeNull();
  });
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

  it('hides the loose switch when asked', async () => {
    const view = await render(<Harness showLooseSwitch={false} />);

    expect(view.queryByTestId('export-loose')).toBeNull();
  });

  it('asks a linear story nothing about scene order', async () => {
    const view = await render(<Harness />);
    expect(view.queryByTestId('export-scene-order-discovery')).toBeNull();
  });

  it('asks a branching story how its gamebook is numbered', async () => {
    const view = await render(<Harness branching />);
    expect(latest?.sceneOrder).toBe('discovery');
    await fireEvent.press(view.getByTestId('export-scene-order-shuffled'));
    expect(latest).toMatchObject({ sceneOrder: 'shuffled', preset: 'custom' });
    await fireEvent.press(view.getByTestId('export-scene-order-discovery'));
    expect(latest?.sceneOrder).toBe('discovery');
  });
});
