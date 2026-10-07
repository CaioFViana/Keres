import { parseMelody } from '@keres/shared';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import LeadSheetView from '../../src/components/features/songs/LeadSheetView';
import MelodyPanel from '../../src/components/features/songs/MelodyPanel';

const mockAlert = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
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
  for (const mock of [onChange, onBlur, onPlay, onStop, onTone, onExport, mockAlert])
    mock.mockReset();
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

describe('MelodyPanel writing a part', () => {
  it('keeps the keyboard shut until a part is opened to be written', async () => {
    const view = await render(panel());
    await settle();

    expect(view.queryByTestId('piano-keys')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    expect(view.getByTestId('melody-editor-0')).toBeTruthy();
    expect(view.getByTestId('piano-keys')).toBeTruthy();
    await fireEvent.press(view.getByTestId('melody-part-0'));
    expect(view.queryByTestId('piano-keys')).toBeNull();
  });

  it('opens one part at a time', async () => {
    const view = await render(panel());
    await settle();

    await fireEvent.press(view.getByTestId('melody-part-0'));
    await fireEvent.press(view.getByTestId('melody-part-1'));

    expect(view.queryByTestId('melody-editor-0')).toBeNull();
    expect(view.getByTestId('melody-editor-1')).toBeTruthy();
  });

  it('writes the note of a key into the part that is open, at the length chosen, and sounds it', async () => {
    const view = await render(panel({ melody: '', songKey: 'F' }));
    await settle();

    await fireEvent.press(view.getByTestId('melody-part-1'));
    await fireEvent.press(view.getByTestId('melody-length-0.5'));
    await fireEvent.press(view.getByTestId('piano-key-70'));

    // B flat in the key of F; half a quarter note.
    expect(onChange).toHaveBeenLastCalledWith('P:Chorus\n_B/2');
    expect(onTone).toHaveBeenCalledWith(70, 'hum');
  });

  it('writes a rest without sounding anything, and takes the last note of that part back', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    await fireEvent.press(view.getByTestId('melody-rest'));
    expect(onChange).toHaveBeenLastCalledWith('P:Verse 1\nC D z');
    expect(onTone).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('melody-backspace'));
    expect(onChange).toHaveBeenLastCalledWith('P:Verse 1\nC');
  });

  it('moves the keyboard an octave at a time, and stops at either end', async () => {
    const view = await render(panel());
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    expect(view.getByTestId('melody-range').props.children).toBe('C4 – C6');
    await fireEvent.press(view.getByTestId('melody-octave-down'));
    expect(view.getByTestId('melody-range').props.children).toBe('C3 – C5');
    expect(view.getByTestId('piano-key-48')).toBeTruthy();
    await fireEvent.press(view.getByTestId('melody-octave-down'));
    expect(view.getByTestId('melody-range').props.children).toBe('C2 – C4');
    expect(view.getByTestId('melody-octave-down').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('melody-octave-up'));
    await fireEvent.press(view.getByTestId('melody-octave-up'));
    await fireEvent.press(view.getByTestId('melody-octave-up'));
    expect(view.getByTestId('melody-range').props.children).toBe('C5 – C7');
    expect(view.getByTestId('melody-octave-up').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the keys clear of the arrows above them', async () => {
    const view = await render(panel());
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    const style = StyleSheet.flatten(view.getByTestId('melody-piano').props.style);
    expect(style.marginTop).toBeGreaterThanOrEqual(8);
  });

  it('offers no keyboard and no way to open a part to someone who cannot edit, and still plays', async () => {
    const view = await render(panel({ editable: false, melody: 'C D E F' }));
    await settle();

    await fireEvent.press(view.getByTestId('melody-part-0'));
    expect(view.queryByTestId('piano-keys')).toBeNull();
    expect(view.getByTestId('song-melody').props.editable).toBe(false);
    await fireEvent.press(view.getByTestId('melody-play'));
    expect(onPlay).toHaveBeenCalled();
  });
});

describe('MelodyPanel suggesting a tune', () => {
  it('writes a tune with a note for every syllable of the part when it has none', async () => {
    const view = await render(panel({ songKey: 'G' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    await fireEvent.press(view.getByTestId('melody-suggest'));

    expect(mockAlert).not.toHaveBeenCalled();
    const written = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
    expect(written.startsWith('P:Verse 1\n')).toBe(true);
    expect(parseMelody(written).sections[0].syllables).toBe(4);
  });

  it('gives the next try another tune', async () => {
    const view = await render(panel({ songKey: 'G' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    await fireEvent.press(view.getByTestId('melody-suggest'));
    const first = onChange.mock.calls[0][0];
    await fireEvent.press(view.getByTestId('melody-suggest'));

    expect(onChange.mock.calls[1][0]).not.toBe(first);
  });

  it('asks before it replaces a tune the writer has, and writes only if told to', async () => {
    const view = await render(panel({ melody: 'P:Verse 1\nC D E F' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    expect(view.getByText('melody_suggest_again')).toBeTruthy();
    await fireEvent.press(view.getByTestId('melody-suggest'));
    expect(onChange).not.toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons.map((button) => button.text)).toEqual(['cancel', 'melody_suggest_again']);

    await act(async () => buttons[1].onPress?.());
    expect(parseMelody(onChange.mock.calls[0][0]).sections[0].syllables).toBe(4);
  });

  it('suggests for a part that only borrows a tune without asking, as it has none of its own', async () => {
    const lyrics =
      '{sov: Verse 1}\nOne two three four\n{eov}\n{sov: Verse 2}\nFive six nine ten\n{eov}';
    const view = await render(panel({ lyrics, melody: 'P:Verse 1\nC D E F' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-1'));

    await fireEvent.press(view.getByTestId('melody-suggest'));

    expect(mockAlert).not.toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toContain('P:Verse 2\n');
    expect(onChange.mock.calls[0][0]).toContain('P:Verse 1\nC D E F');
  });

  it('puts the tune in the key of the song', async () => {
    const view = await render(panel({ songKey: 'Bb' }));
    await settle();
    await fireEvent.press(view.getByTestId('melody-part-0'));

    await fireEvent.press(view.getByTestId('melody-suggest'));

    expect(onChange.mock.calls[0][0]).toMatch(/_[BE]/);
  });
});

describe('MelodyPanel notes as text and files', () => {
  it('keeps them folded for someone who can write, and unfolds them on request', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    expect(view.queryByTestId('song-melody')).toBeNull();
    expect(view.queryByTestId('melody-export-midi')).toBeNull();
    await fireEvent.press(view.getByTestId('melody-more-toggle'));
    await fireEvent.changeText(view.getByTestId('song-melody'), 'C D');
    await fireEvent(view.getByTestId('song-melody'), 'blur');

    expect(onChange).toHaveBeenCalledWith('C D');
    expect(onBlur).toHaveBeenCalled();
  });

  it('shows them from the start to someone who can only read', async () => {
    const view = await render(panel({ editable: false, melody: 'C D' }));

    expect(view.getByTestId('melody-export-midi')).toBeTruthy();
  });

  it('exports the tune in either file', async () => {
    const view = await render(panel({ melody: 'C D E F' }));
    await fireEvent.press(view.getByTestId('melody-more-toggle'));

    await fireEvent.press(view.getByTestId('melody-export-midi'));
    await fireEvent.press(view.getByTestId('melody-export-abc'));

    expect(onExport.mock.calls).toEqual([
      ['midi', VOICE],
      ['abc', VOICE],
    ]);
  });

  it('takes the accompaniment chosen into the file it hands over', async () => {
    const view = await render(panel({ melody: 'C D E F' }));

    await fireEvent.press(view.getByTestId('melody-options-toggle'));
    await fireEvent.press(view.getByTestId('melody-instrument-piano'));
    await fireEvent.press(view.getByTestId('melody-more-toggle'));
    await fireEvent.press(view.getByTestId('melody-export-midi'));

    expect(onExport).toHaveBeenLastCalledWith('midi', { ...VOICE, instrument: 'piano' });
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
