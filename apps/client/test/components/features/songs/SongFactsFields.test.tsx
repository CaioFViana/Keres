import { cleanup, fireEvent, render } from '@testing-library/react-native';
import SongFactsFields from '../../../../src/components/features/songs/SongFactsFields';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: { min?: number; max?: number }) =>
      options?.min !== undefined ? `${key}:${options.min}-${options.max}` : key,
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

const onKeyChange = jest.fn();
const onTempoChange = jest.fn();
const onMeterChange = jest.fn();

const renderFields = (props: Partial<React.ComponentProps<typeof SongFactsFields>> = {}) =>
  render(
    <SongFactsFields
      keyValue={null}
      tempo={null}
      meter={null}
      editable
      onKeyChange={onKeyChange}
      onTempoChange={onTempoChange}
      onMeterChange={onMeterChange}
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SongFactsFields', () => {
  it('shows the facts the song states', async () => {
    const view = await renderFields({ keyValue: 'Em', tempo: 90, meter: '3/4' });

    expect(view.getByTestId('song-key').props.value).toBe('Em');
    expect(view.getByTestId('song-tempo').props.value).toBe('90');
    expect(view.getByTestId('song-meter-3-4').props.accessibilityState.selected).toBe(true);
  });

  it('keeps a key only once it is one, and says so while it is not', async () => {
    const view = await renderFields();

    await fireEvent.changeText(view.getByTestId('song-key'), 'H');
    expect(onKeyChange).not.toHaveBeenCalled();
    expect(view.getByText('song_key_invalid')).toBeTruthy();

    await fireEvent.changeText(view.getByTestId('song-key'), 'Bb');
    expect(onKeyChange).toHaveBeenLastCalledWith('Bb');
    expect(view.queryByText('song_key_invalid')).toBeNull();
  });

  it('clears the key when the field is emptied', async () => {
    const view = await renderFields({ keyValue: 'G' });

    await fireEvent.changeText(view.getByTestId('song-key'), '');

    expect(onKeyChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps a tempo only inside its range, and says the range while it is not', async () => {
    const view = await renderFields();

    await fireEvent.changeText(view.getByTestId('song-tempo'), '5');
    expect(onTempoChange).not.toHaveBeenCalled();
    expect(view.getByText('song_tempo_invalid:20-300')).toBeTruthy();

    await fireEvent.changeText(view.getByTestId('song-tempo'), '120');
    expect(onTempoChange).toHaveBeenLastCalledWith(120);

    await fireEvent.changeText(view.getByTestId('song-tempo'), '');
    expect(onTempoChange).toHaveBeenLastCalledWith(null);
  });

  it('picks a meter, and takes it back when it is pressed again', async () => {
    const first = await renderFields();
    await fireEvent.press(first.getByTestId('song-meter-6-8'));
    expect(onMeterChange).toHaveBeenLastCalledWith('6/8');
    await first.unmount();

    const second = await renderFields({ meter: '6/8' });
    await fireEvent.press(second.getByTestId('song-meter-6-8'));
    expect(onMeterChange).toHaveBeenLastCalledWith(null);
  });

  it('changes nothing for someone who cannot edit', async () => {
    const view = await renderFields({ editable: false, meter: '4/4' });

    expect(view.getByTestId('song-key').props.editable).toBe(false);
    expect(view.getByTestId('song-tempo').props.editable).toBe(false);
    expect(view.getByTestId('song-meter-3-4').props.accessibilityState.disabled).toBe(true);
  });
});
