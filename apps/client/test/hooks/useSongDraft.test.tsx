import { act, cleanup, renderHook } from '@testing-library/react-native';
import type { SongSelect } from '../../src/db/schema';
import { SONG_SAVE_DELAY_MS, useSongDraft } from '../../src/hooks/useSongDraft';

const mockUpdateSong = jest.fn();

jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));
jest.mock('../../src/services/storymanagement/SongService', () => ({
  __esModule: true,
  createSongService: () => ({ updateSong: mockUpdateSong }),
}));

const song = {
  id: 'song-1',
  storyId: 'story-1',
  title: 'Tavern song',
  lyrics: 'old',
  notes: null,
  lyricsTranslation: null,
  melody: null,
  key: 'G',
  tempo: 90,
  meter: '3/4',
} as unknown as SongSelect;

beforeEach(() => {
  jest.useFakeTimers();
  mockUpdateSong.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useSongDraft', () => {
  it('shows what is saved until something is typed, and what is typed after', async () => {
    const { result } = await renderHook(() => useSongDraft(song));

    expect(result.current.value('lyrics')).toBe('old');
    await act(async () => result.current.setField('lyrics', 'new'));

    expect(result.current.value('lyrics')).toBe('new');
    expect(result.current.value('title')).toBe('Tavern song');
    expect(result.current.dirty).toBe(true);
  });

  it('writes nothing while the person keeps typing, and the fields touched once they pause', async () => {
    const { result } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.setField('lyrics', 'n'));
    await act(async () => jest.advanceTimersByTime(SONG_SAVE_DELAY_MS - 100));
    await act(async () => result.current.setField('lyrics', 'ne'));
    await act(async () => result.current.setField('tempo', 100));
    await act(async () => jest.advanceTimersByTime(SONG_SAVE_DELAY_MS - 100));
    expect(mockUpdateSong).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(200));

    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', { lyrics: 'ne', tempo: 100 });
  });

  it('is no longer a draft once it is written', async () => {
    const { result } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.setField('lyrics', 'new'));
    await act(async () => result.current.flush());

    expect(result.current.dirty).toBe(false);
    expect(result.current.value('lyrics')).toBe('old');
  });

  it('writes at once when asked, and not again for a draft with nothing in it', async () => {
    const { result } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.flush());
    expect(mockUpdateSong).not.toHaveBeenCalled();

    await act(async () => result.current.setField('notes', 'for the bard'));
    await act(async () => result.current.flush());
    expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', { notes: 'for the bard' });
  });

  it('keeps what was typed while a write was on its way', async () => {
    let finish: () => void = () => {};
    mockUpdateSong.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.setField('lyrics', 'one'));
    let flushing: Promise<void> = Promise.resolve();
    await act(async () => {
      flushing = result.current.flush();
    });
    await act(async () => result.current.setField('lyrics', 'one two'));
    await act(async () => {
      finish();
      await flushing;
    });

    expect(result.current.value('lyrics')).toBe('one two');
    expect(result.current.dirty).toBe(true);
  });

  it('keeps the draft and says so when the song cannot be saved', async () => {
    mockUpdateSong.mockRejectedValueOnce(new Error('A song needs a title.'));
    const { result } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.setField('title', ''));
    await act(async () => result.current.flush());

    expect(result.current.error).toBe('A song needs a title.');
    expect(result.current.value('title')).toBe('');
    expect(result.current.dirty).toBe(true);
  });

  it('saves what is left when the screen closes', async () => {
    const { result, unmount } = await renderHook(() => useSongDraft(song));

    await act(async () => result.current.setField('lyrics', 'last words'));
    await unmount();

    expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', { lyrics: 'last words' });
  });

  it('writes nothing for a song that is not there', async () => {
    const { result } = await renderHook(() => useSongDraft(null));

    await act(async () => result.current.setField('lyrics', 'x'));
    await act(async () => result.current.flush());

    expect(mockUpdateSong).not.toHaveBeenCalled();
  });
});
