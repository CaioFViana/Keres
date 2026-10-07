import { cleanup, fireEvent, render } from '@testing-library/react-native';
import SongLyricsEditor from '../../../../src/components/features/songs/SongLyricsEditor';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      onPrimary: '#fff',
      border: '#ccc',
      error: '#f00',
      background: '#fff',
      surface: '#fff',
    },
  }),
}));
jest.mock('../../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});

const words = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };
const onChange = jest.fn();
const onTranspose = jest.fn();

const renderEditor = (value: string, editable = true) =>
  render(
    <SongLyricsEditor
      value={value}
      onChange={onChange}
      onTranspose={onTranspose}
      editable={editable}
      words={words}
      syllableLanguage="en"
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SongLyricsEditor', () => {
  it('writes the lyrics it is given and hands back what is typed', async () => {
    const view = await renderEditor('[G]Night');

    expect(view.getByTestId('song-lyrics').props.value).toBe('[G]Night');
    await fireEvent.changeText(view.getByTestId('song-lyrics'), '[G]Night falls');
    expect(onChange).toHaveBeenCalledWith('[G]Night falls');
  });

  it('adds a section with its label written out, ready to write in', async () => {
    const view = await renderEditor('');

    await fireEvent.press(view.getByTestId('song-add-verse'));

    expect(onChange).toHaveBeenCalledWith('{start_of_verse: Verse 1}\n\n{end_of_verse}\n');
  });

  it('numbers the verse past the ones already there, and keeps a first chorus plain', async () => {
    const view = await renderEditor('{start_of_verse: Verse 1}\nOne\n{end_of_verse}\n');

    await fireEvent.press(view.getByTestId('song-add-verse'));
    expect(onChange.mock.calls[0][0]).toContain('{start_of_verse: Verse 2}');

    await fireEvent.press(view.getByTestId('song-add-chorus'));
    expect(onChange.mock.calls[1][0]).toContain('{start_of_chorus: Chorus}');
  });

  it('moves the chords a semitone up or down through the screen, which owns the key', async () => {
    const view = await renderEditor('[G]Night');

    await fireEvent.press(view.getByTestId('song-transpose-up'));
    await fireEvent.press(view.getByTestId('song-transpose-down'));

    expect(onTranspose.mock.calls).toEqual([[1], [-1]]);
  });

  it('warns of sections that share a name, and numbers them on request', async () => {
    const twice = '{sov: Verse}\na\n{eov}\n{sov: Verse}\nb\n{eov}';
    const view = await renderEditor(twice);

    expect(view.getByTestId('song-duplicates')).toBeTruthy();
    await fireEvent.press(view.getByTestId('song-number-duplicates'));

    expect(onChange).toHaveBeenCalledWith('{sov: Verse 1}\na\n{eov}\n{sov: Verse 2}\nb\n{eov}');
  });

  it('says nothing when every section has a name of its own', async () => {
    const view = await renderEditor('{sov: One}\na\n{eov}\n{sov: Two}\nb\n{eov}');

    expect(view.queryByTestId('song-duplicates')).toBeNull();
  });

  it('shows the sheet instead of the field, and counts syllables only when switched on', async () => {
    const view = await renderEditor('[G]Night de[Em]scends');

    await fireEvent.press(view.getByTestId('song-mode-sheet'));
    expect(view.queryByTestId('song-lyrics')).toBeNull();
    expect(view.getByTestId('lead-sheet')).toBeTruthy();
    expect(view.queryAllByTestId('syllable-count')).toHaveLength(0);

    await fireEvent.press(view.getByTestId('song-toggle-syllables'));
    expect(view.getAllByTestId('syllable-count')).toHaveLength(1);

    await fireEvent.press(view.getByTestId('song-mode-write'));
    expect(view.getByTestId('song-lyrics')).toBeTruthy();
  });

  it('offers no way to change the text to someone who cannot edit', async () => {
    const view = await renderEditor('[G]Night', false);

    expect(view.getByTestId('song-lyrics').props.editable).toBe(false);
    expect(view.queryByTestId('song-add-verse')).toBeNull();
    expect(view.queryByTestId('song-transpose-up')).toBeNull();
  });

  it('counts the characters against the limit', async () => {
    const view = await renderEditor('abc');

    expect(view.getByText('song_lyrics_count:{"count":3,"max":16000}')).toBeTruthy();
  });
});
