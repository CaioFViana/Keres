import { cleanup, fireEvent, render } from '@testing-library/react-native';
import LeadSheetView from '../../../../src/components/features/songs/LeadSheetView';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
  }),
}));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: { text: '#111', textSecondary: '#555', primary: '#00f', border: '#ccc' },
  }),
}));

const words = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };

afterEach(() => {
  cleanup();
});

describe('LeadSheetView', () => {
  const lyrics = [
    '{sov: Verse 1}',
    '[G]Night de[Em]scends',
    'Plain words',
    '{eov}',
    '{soc: Chorus}',
    '{chorus: Verse 1}',
    '{comment: twice}',
    '{eoc}',
  ].join('\n');

  it('names each section and draws the chords over the words they fall on', async () => {
    const view = await render(<LeadSheetView lyrics={lyrics} words={words} />);

    expect(view.getByText('Verse 1')).toBeTruthy();
    expect(view.getByText('Chorus')).toBeTruthy();
    expect(view.getByText('G')).toBeTruthy();
    expect(view.getByText('Em')).toBeTruthy();
    expect(view.getByText('Night de')).toBeTruthy();
    expect(view.getByText('scends')).toBeTruthy();
  });

  it('draws a line with no chords as one piece of text', async () => {
    const view = await render(<LeadSheetView lyrics={lyrics} words={words} />);

    expect(view.getByText('Plain words')).toBeTruthy();
  });

  it('draws a recall as its label in brackets and a comment as it is', async () => {
    const view = await render(<LeadSheetView lyrics={lyrics} words={words} />);

    expect(view.getByText('(Verse 1)')).toBeTruthy();
    expect(view.getByText('twice')).toBeTruthy();
  });

  it('counts the syllables of each line only when asked', async () => {
    const without = await render(<LeadSheetView lyrics={lyrics} words={words} />);
    expect(without.queryAllByTestId('syllable-count')).toHaveLength(0);
    await without.unmount();

    const counted = await render(
      <LeadSheetView lyrics={lyrics} words={words} syllableLanguage="en" />,
    );
    const counts = counted.getAllByTestId('syllable-count').map((el) => el.props.children);
    expect(counts).toEqual([3, 2]);
  });

  it('says so when there is nothing written', async () => {
    const view = await render(<LeadSheetView lyrics="" words={words} />);

    expect(view.getByText('song_sheet_empty')).toBeTruthy();
  });

  it('draws the first rows of a long song and keeps the rest behind a button', async () => {
    const long = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`).join('\n');
    const view = await render(<LeadSheetView lyrics={long} words={words} firstRows={10} />);

    expect(view.getAllByTestId('lead-sheet-line')).toHaveLength(10);
    expect(view.getByText('song_sheet_show_all:20')).toBeTruthy();

    await fireEvent.press(view.getByText('song_sheet_show_all:20'));

    expect(view.getAllByTestId('lead-sheet-line')).toHaveLength(30);
    expect(view.queryByText(/song_sheet_show_all/)).toBeNull();
  });
});
