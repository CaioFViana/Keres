import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import LeadSheetView from '../../src/components/features/songs/LeadSheetView';
import MelodyPanel from '../../src/components/features/songs/MelodyPanel';

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
const VOICE = { timbre: 'hum', click: false, instrument: null, feel: 'auto' };

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
    tempo={120}
    meter={'4/4'}
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

/** The parts and the length are worked out after a pause in typing. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

beforeEach(() => {
  for (const mock of [onChange, onBlur, onPlay, onStop, onTone, onExport]) mock.mockReset();
});
afterEach(async () => {
  await act(async () => cleanup());
});

describe('MelodyPanel hearing it', () => {
  it('has one big button that plays the song, and keeps the sound options out of the way', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    expect(view.queryByTestId('melody-options')).toBeNull();
    expect(view.queryByTestId('melody-voice-la')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-play'));

    expect(onPlay).toHaveBeenLastCalledWith({ kind: 'song' }, VOICE);
  });

  it('opens the sound options on request, and plays with what was chosen there', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    await fireEvent.press(view.getByTestId('melody-options-toggle'));
    await fireEvent.press(view.getByTestId('melody-voice-la'));
    await fireEvent.press(view.getByTestId('melody-click'));
    await fireEvent.press(view.getByTestId('melody-play'));

    expect(onPlay).toHaveBeenLastCalledWith(
      { kind: 'song' },
      { ...VOICE, timbre: 'la', click: true },
    );
  });

  it('says in a line what it will play with, so the options need not be open to know', async () => {
    const view = await render(panel({ melody: 'C D E F' }));
    expect(view.getByTestId('melody-summary').props.children).toBe('melody_voice_hum');

    await fireEvent.press(view.getByTestId('melody-options-toggle'));
    await fireEvent.press(view.getByTestId('melody-voice-ah'));
    await fireEvent.press(view.getByTestId('melody-instrument-guitar'));
    await fireEvent.press(view.getByTestId('melody-feel-waltz'));
    await fireEvent.press(view.getByTestId('melody-click'));

    expect(view.getByTestId('melody-summary').props.children).toBe(
      'melody_voice_ah · melody_instrument_guitar, melody_feel_waltz · melody_click',
    );
  });

  it('asks for an instrument under the voice, and for a feel only when one can use it', async () => {
    const view = await render(panel({ melody: 'C D E F' }));
    await fireEvent.press(view.getByTestId('melody-options-toggle'));

    expect(view.queryByTestId('melody-feel-waltz')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-instrument-guitar'));
    expect(view.getByTestId('melody-feel-waltz')).toBeTruthy();
    await fireEvent.press(view.getByTestId('melody-feel-waltz'));
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenLastCalledWith(
      { kind: 'song' },
      { ...VOICE, instrument: 'guitar', feel: 'waltz' },
    );

    await fireEvent.press(view.getByTestId('melody-instrument-violin'));
    expect(view.queryByTestId('melody-feel-waltz')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-instrument-none'));
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenLastCalledWith({ kind: 'song' }, { ...VOICE, feel: 'waltz' });
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

  it('says how long the song runs: measured by its tune, guessed without one', async () => {
    const guessed = await render(
      panel({ lyrics: '{sov: V}\n[G]One two [C]three four\n{eov}', melody: '' }),
    );
    await settle();
    expect(guessed.getByTestId('melody-length').props.children).toBe(
      'melody_length_estimated:{"time":"0:04"}',
    );
    await guessed.unmount();

    const measured = await render(
      panel({ lyrics: '{sov: V}\nOne two three four\n{eov}', melody: 'C D E F' }),
    );
    await settle();
    expect(measured.getByTestId('melody-length').props.children).toBe(
      'melody_length:{"time":"0:02"}',
    );
  });
});

describe('MelodyPanel parts', () => {
  it('says for each part how its notes meet its syllables, and which tune it borrows', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E\nP:Chorus\ng a' }));
    await settle();

    expect(
      view.getByText('melody_part_short:{"notes":3,"syllables":4,"difference":1}'),
    ).toBeTruthy();
    expect(
      view.getByText('melody_part_match:{"notes":2,"syllables":2,"difference":0}'),
    ).toBeTruthy();
  });

  it('says a part has no tune yet, and explains when the lyrics have no parts', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E F' }));
    await settle();
    expect(view.getByText('melody_part_none')).toBeTruthy();
    await view.unmount();

    const empty = await render(panel({ lyrics: '', melody: '' }));
    await settle();
    expect(empty.getByTestId('melody-parts-empty')).toBeTruthy();
  });

  it('plays one part from its own button, with the sound chosen', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E F' }));
    await settle();

    await fireEvent.press(view.getByTestId('melody-part-play-1'));

    expect(onPlay).toHaveBeenLastCalledWith({ kind: 'section', index: 1 }, VOICE);
  });

  it('lists the notes it did not understand', async () => {
    const view = await render(panel({ melody: 'C ? D' }));
    await settle();

    expect(view.getByTestId('melody-errors').props.children).toContain('melody_errors');
  });
});

describe('MelodyPanel writing', () => {
  it('writes the note of a key into the part chosen, at the length chosen, and sounds it', async () => {
    const view = await render(panel({ melody: '', songKey: 'F' }));
    await settle();

    await fireEvent.press(view.getByTestId('melody-part-1'));
    await fireEvent.press(view.getByTestId('melody-length-0.5'));
    await fireEvent.press(view.getByTestId('piano-key-70'));

    // B flat in the key of F; half a quarter note.
    expect(onChange).toHaveBeenLastCalledWith('P:Chorus\n_B/2');
    expect(onTone).toHaveBeenCalledWith(70, 'hum');
  });

  it('writes into the first named part until another is chosen, and says which', async () => {
    const view = await render(panel({ melody: '' }));
    await settle();

    expect(view.getByText('melody_write_into:{"label":"Verse 1"}')).toBeTruthy();
    await fireEvent.press(view.getByTestId('piano-key-60'));
    expect(onChange).toHaveBeenLastCalledWith('P:Verse 1\nC');
  });

  it('writes a rest without sounding anything, and takes the last note back', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D' }));
    await settle();

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

  it('offers no keyboard to someone who cannot edit, shows the notes as text, and still plays', async () => {
    const view = await render(panel({ editable: false, melody: 'C D E F' }));

    expect(view.queryByTestId('piano-keys')).toBeNull();
    expect(view.getByTestId('song-melody').props.editable).toBe(false);
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenCalled();
  });

  it('keeps the notes as text folded for someone who can write, and unfolds them on request', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    expect(view.queryByTestId('song-melody')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-notation-toggle'));
    await fireEvent.changeText(view.getByTestId('song-melody'), 'C D');
    await fireEvent(view.getByTestId('song-melody'), 'blur');

    expect(onChange).toHaveBeenCalledWith('C D');
    expect(onBlur).toHaveBeenCalled();
  });

  it('exports the tune in either file', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    await fireEvent.press(view.getByTestId('melody-export-midi'));
    await fireEvent.press(view.getByTestId('melody-export-abc'));

    expect(onExport.mock.calls).toEqual([['midi'], ['abc']]);
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
