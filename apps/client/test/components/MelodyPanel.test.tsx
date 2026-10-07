import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import MelodyPanel from '../../src/components/features/songs/MelodyPanel';
import LeadSheetView from '../../src/components/features/songs/LeadSheetView';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      primaryContainer: '#ccf',
      onPrimary: '#fff',
      border: '#ccc',
      surface: '#fff',
      error: '#f00',
    },
  }),
}));
jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});

const words = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };
const LYRICS = '{sov: Verse 1}\nOne two three four\n{eov}\n{soc: Chorus}\nLa la\n{eoc}';

const onChange = jest.fn();
const onBlur = jest.fn();
const onPlay = jest.fn();
const onStop = jest.fn();
const onTone = jest.fn();
const onExport = jest.fn();

const panel = (props: Partial<React.ComponentProps<typeof MelodyPanel>> = {}) => (
  <MelodyPanel
    lyrics={LYRICS}
    melody=""
    songKey={null}
    editable
    words={words}
    language="en"
    onChange={onChange}
    onBlur={onBlur}
    phase="idle"
    progress={0}
    problem={null}
    active={null}
    onPlay={onPlay}
    onStop={onStop}
    onTone={onTone}
    onExport={onExport}
    {...props}
  />
);

beforeEach(() => {
  for (const mock of [onChange, onBlur, onPlay, onStop, onTone, onExport]) mock.mockReset();
});
afterEach(async () => {
  await act(async () => cleanup());
});

describe('MelodyPanel', () => {
  it('says for each part how its notes meet its syllables', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E\nP:Chorus\ng a' }));
    // The status is worked out after a pause in typing, as the panel is told its text changed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(view.getByText(/melody_status_short.*"label":"Verse 1".*"difference":1/)).toBeTruthy();
    expect(view.getByText(/melody_status_match.*"label":"Chorus"/)).toBeTruthy();
  });

  it('lists the notes it did not understand', async () => {
    await act(async () => {});
    const view = await render(panel({ melody: 'C ? D' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(view.getByTestId('melody-errors').props.children).toContain('melody_errors');
  });

  it('plays the song first, with the voice and click chosen', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenLastCalledWith({ kind: 'song' }, { timbre: 'hum', click: false });

    await fireEvent.press(view.getByTestId('melody-voice-la'));
    await fireEvent.press(view.getByTestId('melody-click'));
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenLastCalledWith({ kind: 'song' }, { timbre: 'la', click: true });
  });

  it('plays one part when it is chosen', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E F' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await fireEvent.press(view.getByTestId('melody-scope-1'));
    await fireEvent.press(view.getByTestId('melody-play'));

    expect(onPlay).toHaveBeenLastCalledWith(
      { kind: 'section', index: 1 },
      { timbre: 'hum', click: false },
    );
  });

  it('turns play into stop while it prepares or plays, and shows how far it is', async () => {
    const view = await render(panel({ phase: 'preparing', progress: 0.4 }));

    expect(view.getByText('melody_preparing:{"percent":40}')).toBeTruthy();
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onStop).toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('shows the line being sung, and what went wrong', async () => {
    const singing = await render(
      panel({ phase: 'playing', active: { sectionIndex: 0, sourceIndex: 1, text: 'One two' } }),
    );
    expect(singing.getByTestId('melody-now').props.children).toBe('♪ One two');
    await singing.unmount();

    const failed = await render(panel({ problem: 'no-tune' }));
    expect(failed.getByTestId('melody-problem').props.children).toBe('melody_no_tune');
  });

  it('writes the note of a key into the part chosen, at the length chosen, and sounds it', async () => {
    const view = await render(panel({ melody: '', songKey: 'F' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await fireEvent.press(view.getByTestId('melody-target-Chorus'));
    await fireEvent.press(view.getByTestId('melody-length-0.5'));
    await fireEvent.press(view.getByTestId('piano-key-70'));

    // B flat in the key of F; half a quarter note.
    expect(onChange).toHaveBeenLastCalledWith('P:Chorus\n_B/2');
    expect(onTone).toHaveBeenCalledWith(70, 'hum');
  });

  it('writes a rest without sounding anything, and takes the last note back', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await fireEvent.press(view.getByTestId('melody-rest'));
    expect(onChange).toHaveBeenLastCalledWith('P:Verse 1\nC D z');
    expect(onTone).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('melody-backspace'));
    expect(onChange).toHaveBeenLastCalledWith('P:Verse 1\nC');
  });

  it('moves the keyboard an octave when asked', async () => {
    const view = await render(panel());

    expect(view.queryByTestId('piano-key-48')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-octave-48'));
    expect(view.getByTestId('piano-key-48')).toBeTruthy();
  });

  it('offers no keyboard to someone who cannot edit, but still plays', async () => {
    const view = await render(panel({ editable: false, melody: 'C D E F' }));

    expect(view.queryByTestId('piano-keys')).toBeNull();
    expect(view.getByTestId('song-melody').props.editable).toBe(false);
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenCalled();
  });

  it('exports the tune in either file', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    await fireEvent.press(view.getByTestId('melody-export-midi'));
    await fireEvent.press(view.getByTestId('melody-export-abc'));

    expect(onExport.mock.calls).toEqual([['midi'], ['abc']]);
  });

  it('saves the text when it is left', async () => {
    const view = await render(panel({ melody: 'C' }));

    await fireEvent.changeText(view.getByTestId('song-melody'), 'C D');
    await fireEvent(view.getByTestId('song-melody'), 'blur');

    expect(onChange).toHaveBeenCalledWith('C D');
    expect(onBlur).toHaveBeenCalled();
  });
});

describe('LeadSheetView following the song', () => {
  it('marks the line that is being sung, and only that one', async () => {
    const view = await render(
      <LeadSheetView
        lyrics={'{sov: Verse 1}\nOne two\nThree four\n{eov}'}
        words={words}
        activeLine={{ sectionIndex: 0, sourceIndex: 1 }}
      />,
    );

    expect(view.getAllByTestId('lead-sheet-line')).toHaveLength(1);
    expect(view.getAllByTestId('lead-sheet-line-active')).toHaveLength(1);
  });

  it('marks nothing when no line is sung', async () => {
    const view = await render(
      <LeadSheetView lyrics={'{sov: Verse 1}\nOne two\n{eov}'} words={words} />,
    );

    expect(view.queryByTestId('lead-sheet-line-active')).toBeNull();
  });
});
