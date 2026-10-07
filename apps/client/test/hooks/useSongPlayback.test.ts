import { act, renderHook, waitFor } from '@testing-library/react-native';
import { lineAt, useSongPlayback } from '../../src/hooks/useSongPlayback';

const mockPlayer = {
  pause: jest.fn(),
  play: jest.fn(),
  replace: jest.fn(),
};
let mockStatus = { playing: false, currentTime: 0, didJustFinish: false };
const mockRender = jest.fn();
const mockTone = jest.fn();

jest.mock('expo-audio', () => ({
  __esModule: true,
  setAudioModeAsync: () => Promise.resolve(),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));
jest.mock('../../src/services/SongAudioService', () => ({
  __esModule: true,
  createSongAudioService: () => ({
    render: (...args: unknown[]) => mockRender(...args),
    tone: (...args: unknown[]) => mockTone(...args),
  }),
}));

const words = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };
const LYRICS = '{sov: Verse 1}\nOne two\nThree four\n{eov}\n{soc: Chorus}\nLa la\n{eoc}';
const input = (overrides: Partial<Parameters<typeof useSongPlayback>[0]> = {}) => ({
  lyrics: LYRICS,
  melody: 'P:Verse 1\nC D E F\nP:Chorus\ng a',
  tempo: 120,
  meter: '4/4',
  words,
  language: 'en' as const,
  ...overrides,
});
const voice = { timbre: 'hum' as const, click: false };

beforeEach(() => {
  mockStatus = { playing: false, currentTime: 0, didJustFinish: false };
  mockPlayer.pause.mockReset();
  mockPlayer.play.mockReset();
  mockPlayer.replace.mockReset();
  mockRender.mockReset().mockResolvedValue({ uri: 'file:///a.wav', seconds: 4, cached: false });
  mockTone.mockReset().mockResolvedValue('file:///tone.wav');
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('lineAt', () => {
  const lines = [
    { sectionIndex: 0, lineIndex: 0, sourceIndex: 0, text: 'a', start: 0, end: 2 },
    { sectionIndex: 0, lineIndex: 1, sourceIndex: 1, text: 'b', start: 4, end: 6 },
  ];

  it('finds the line being sung, and holds it through a short rest', () => {
    expect(lineAt(lines, 1)?.text).toBe('a');
    expect(lineAt(lines, 3)?.text).toBe('a');
    expect(lineAt(lines, 5)?.text).toBe('b');
  });

  it('shows nothing before the first line or long after the last', () => {
    expect(lineAt(lines, -1)).toBeNull();
    expect(lineAt(lines, 9)).toBeNull();
    expect(lineAt([], 1)).toBeNull();
  });
});

describe('useSongPlayback', () => {
  it('says there is no tune instead of rendering one', async () => {
    const { result } = await renderHook(() => useSongPlayback(input({ melody: '' })));

    await act(async () => result.current.play({ kind: 'song' }, voice));

    expect(result.current.problem).toBe('no-tune');
    expect(result.current.phase).toBe('idle');
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('renders the first minute and a half of the song and plays the file', async () => {
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => result.current.play({ kind: 'song' }, voice));

    const [score, options] = mockRender.mock.calls[0];
    expect(score.notes.map((n: { pitch: number }) => n.pitch)).toEqual([60, 62, 64, 65, 79, 81]);
    expect(score.tempo).toBe(120);
    expect(options).toEqual({ timbre: 'hum' });
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'file:///a.wav' });
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(result.current.phase).toBe('playing');
  });

  it('plays one section alone, with a click on the beat if asked', async () => {
    const { result } = await renderHook(() => useSongPlayback(input({ meter: '3/4' })));

    await act(async () =>
      result.current.play({ kind: 'section', index: 1 }, { timbre: 'la', click: true }),
    );

    const [score, options] = mockRender.mock.calls[0];
    expect(score.notes.map((n: { pitch: number }) => n.pitch)).toEqual([79, 81]);
    expect(options).toEqual({ timbre: 'la', clickBeatsPerBar: 3 });
  });

  it('reports the preparation while it renders, and ignores a result that arrives after stop', async () => {
    let finish: (value: unknown) => void = () => {};
    mockRender.mockImplementation(
      (_score, _options, hooks: { onProgress: (n: number) => void }) =>
        new Promise((resolve) => {
          hooks.onProgress(0.5);
          finish = resolve;
        }),
    );
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => {
      void result.current.play({ kind: 'song' }, voice);
    });
    expect(result.current.phase).toBe('preparing');
    expect(result.current.progress).toBe(0.5);

    await act(async () => result.current.stop());
    await act(async () => finish({ uri: 'file:///late.wav', seconds: 1, cached: false }));

    expect(result.current.phase).toBe('idle');
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('tells the render to stop when the person stops it', async () => {
    let cancelled: (() => boolean) | undefined;
    mockRender.mockImplementation(async (_s, _o, hooks: { isCancelled: () => boolean }) => {
      cancelled = hooks.isCancelled;
      return null;
    });
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => {
      void result.current.play({ kind: 'song' }, voice);
    });
    expect(cancelled?.()).toBe(false);
    await act(async () => result.current.stop());

    expect(cancelled?.()).toBe(true);
  });

  it('says it failed when the rendering throws', async () => {
    mockRender.mockRejectedValue(new Error('disk full'));
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => result.current.play({ kind: 'song' }, voice));

    expect(result.current.problem).toBe('failed');
    expect(result.current.phase).toBe('idle');
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('follows the words by the clock of the player, and lets go when the sound ends', async () => {
    const { result, rerender } = await renderHook(() => useSongPlayback(input()));
    await act(async () => result.current.play({ kind: 'song' }, voice));

    // At 120 bpm a beat is half a second: the second line starts at beat 2, one second in.
    mockStatus = { playing: true, currentTime: 1.2, didJustFinish: false };
    await rerender({});
    await waitFor(() => expect(result.current.active?.text).toBe('Three four'));
    expect(result.current.active).toMatchObject({ sectionIndex: 0, sourceIndex: 1 });

    mockStatus = { playing: false, currentTime: 4, didJustFinish: true };
    await rerender({});
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.active).toBeNull();
  });

  it('sounds a key through the player of its own, not the song’s', async () => {
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => result.current.playTone(64, 'ah'));

    expect(mockTone).toHaveBeenCalledWith(64, 'ah');
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'file:///tone.wav' });
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('does not let a failed key break anything', async () => {
    mockTone.mockRejectedValue(new Error('no space'));
    const { result } = await renderHook(() => useSongPlayback(input()));

    await act(async () => result.current.playTone(64, 'hum'));

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.problem).toBeNull();
  });
});
