/** @jest-environment node */
import {
  ShowcaseApiService,
  ShowcaseUnlockError,
  showcaseCoverUrl,
  showcaseSourceUrl,
  type ShowcaseSource,
} from '@/src/services/api/ShowcaseApiService';
import { createKeresAxiosInstance, createPlainAxiosInstance } from '@/src/services/api/apiClient';

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  setTokenProvider: jest.fn(),
  setActiveServer: jest.fn(),
};
const mockPlain = { get: jest.fn() };
const mockSessionToken = jest.fn();

jest.mock('@/src/services/api/apiClient', () => ({
  createKeresAxiosInstance: jest.fn(),
  createPlainAxiosInstance: jest.fn(),
  getServerAccessToken: (...args: unknown[]) => mockSessionToken(...args),
}));
jest.mock('@/src/services/auth/AuthTokenManager', () => ({ authTokenManager: {} }));
const mockValidatePack = jest.fn();
jest.mock('@keres/shared', () => ({
  __esModule: true,
  validatePackContent: (...args: unknown[]) => mockValidatePack(...args),
}));

const server = { id: 'srv', url: 'https://keres.example' } as never;
const registered: ShowcaseSource = { kind: 'server', server };
const guest: ShowcaseSource = { kind: 'guest', origin: 'https://other.example' };
const service = new ShowcaseApiService();

beforeEach(() => {
  jest.clearAllMocks();
  (createKeresAxiosInstance as jest.Mock).mockReturnValue(mockClient);
  (createPlainAxiosInstance as jest.Mock).mockReturnValue(mockPlain);
  mockSessionToken.mockReturnValue(null);
  mockValidatePack.mockImplementation((content) => ({ ...content, valid: true }));
});

describe('showcaseSourceUrl', () => {
  it('is the address of the server, or of the guest origin', () => {
    expect(showcaseSourceUrl(registered)).toBe('https://keres.example');
    expect(showcaseSourceUrl(guest)).toBe('https://other.example');
  });
});

describe('who a request is made as', () => {
  it("binds a registered server's calls to it, so its session can ride along", async () => {
    mockClient.get.mockResolvedValue({ data: { showcaseEnabled: true } });
    await service.getConfig(registered);

    expect(createKeresAxiosInstance).toHaveBeenCalledWith({ baseURL: 'https://keres.example' });
    expect(mockClient.setTokenProvider).toHaveBeenCalled();
    expect(mockClient.setActiveServer).toHaveBeenCalledWith(server);
  });

  it('sends nothing of the person to a server they only have a link to', async () => {
    mockClient.get.mockResolvedValue({ data: { showcaseEnabled: true } });
    await service.getConfig(guest);

    expect(createKeresAxiosInstance).toHaveBeenCalledWith({ baseURL: 'https://other.example' });
    expect(mockClient.setTokenProvider).not.toHaveBeenCalled();
    expect(mockClient.setActiveServer).not.toHaveBeenCalled();
  });
});

describe('getConfig', () => {
  it('returns what the server says about its public site', async () => {
    mockClient.get.mockResolvedValue({
      data: { showcaseEnabled: false, siteName: 'Casa', serverVersion: '1.2.3', other: 1 },
    });

    await expect(service.getConfig(guest)).resolves.toEqual({
      showcaseEnabled: false,
      siteName: 'Casa',
      serverVersion: '1.2.3',
    });
    expect(mockClient.get).toHaveBeenCalledWith('/public/config');
  });

  it('says nothing for a server that is down or that is not a Keres server', async () => {
    mockClient.get.mockRejectedValue(new Error('down'));
    await expect(service.getConfig(guest)).resolves.toBeNull();

    mockClient.get.mockResolvedValue({ data: '<html>' });
    await expect(service.getConfig(guest)).resolves.toBeNull();
    mockClient.get.mockResolvedValue({ data: {} });
    await expect(service.getConfig(guest)).resolves.toBeNull();
  });
});

describe('getStory', () => {
  it('asks for the story by its id, with no credential of its own while it is open', async () => {
    mockClient.get.mockResolvedValue({ data: { storyId: 'S 1' } });

    await expect(service.getStory(guest, 'S 1')).resolves.toEqual({ storyId: 'S 1' });
    expect(mockClient.get).toHaveBeenCalledWith('/public/stories/S%201', { headers: undefined });
  });

  it('hands back the stub of a story behind a password', async () => {
    mockClient.get.mockResolvedValue({ data: { storyId: 'S1', protected: true } });
    await expect(service.getStory(guest, 'S1')).resolves.toEqual({
      storyId: 'S1',
      protected: true,
    });
  });

  it('sends the unlock token as a Showcase credential', async () => {
    mockClient.get.mockResolvedValue({ data: { storyId: 'S1' } });
    await service.getStory(guest, 'S1', 'tok');

    expect(mockClient.get).toHaveBeenCalledWith('/public/stories/S1', {
      headers: { Authorization: 'Showcase tok' },
    });
  });

  it('joins the session and the unlock when a registered server has both', async () => {
    mockSessionToken.mockReturnValue('sess');
    mockClient.get.mockResolvedValue({ data: { storyId: 'S1' } });
    await service.getStory(registered, 'S1', 'tok');

    expect(mockSessionToken).toHaveBeenCalledWith('srv');
    expect(mockClient.get).toHaveBeenCalledWith('/public/stories/S1', {
      headers: { Authorization: 'Bearer sess, Showcase tok' },
    });
  });

  it('lets a missing story reach the caller', async () => {
    mockClient.get.mockRejectedValue({ response: { status: 404 } });
    await expect(service.getStory(guest, 'nope')).rejects.toEqual({ response: { status: 404 } });
  });
});

describe('unlockStory', () => {
  it('trades the password for the token', async () => {
    mockClient.post.mockResolvedValue({ data: { token: 'tok' } });

    await expect(service.unlockStory(guest, 'S1', 'hunter2')).resolves.toBe('tok');
    expect(mockClient.post).toHaveBeenCalledWith('/public/stories/S1/unlock', {
      password: 'hunter2',
    });
  });

  it('says whether the password was wrong, the tries ran out, or the server failed', async () => {
    for (const [status, reason] of [
      [401, 'wrong'],
      [429, 'locked'],
      [500, 'failed'],
      [undefined, 'failed'],
    ] as const) {
      mockClient.post.mockRejectedValueOnce(status ? { response: { status } } : new Error('down'));
      const attempt = service.unlockStory(guest, 'S1', 'x');
      await expect(attempt).rejects.toBeInstanceOf(ShowcaseUnlockError);
      await expect(attempt).rejects.toMatchObject({ reason });
    }
  });
});

describe('getReaderUrl', () => {
  it('turns the relative address the server gives into an absolute one', async () => {
    mockClient.post.mockResolvedValue({
      data: { url: '/api/public/stories/S1/publications/P1/reader?access=abc' },
    });

    await expect(service.getReaderUrl(guest, 'S1', 'P1', 'tok')).resolves.toBe(
      'https://other.example/api/public/stories/S1/publications/P1/reader?access=abc',
    );
    expect(mockClient.post).toHaveBeenCalledWith(
      '/public/stories/S1/publications/P1/reader/url',
      undefined,
      { headers: { Authorization: 'Showcase tok' } },
    );
  });
});

describe('downloadPackage', () => {
  const urlReply = {
    data: { url: '/api/public/stories/S1/publications/P1/download?access=abc' },
  };

  it('asks for a signed address and fetches the bytes from it with nothing of the session', async () => {
    mockClient.post.mockResolvedValue(urlReply);
    mockPlain.get.mockResolvedValue({ data: new Uint8Array([80, 75, 3, 4]).buffer });

    const bytes = await service.downloadPackage(registered, 'S1', 'P1');

    expect(Array.from(bytes)).toEqual([80, 75, 3, 4]);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/public/stories/S1/publications/P1/download-url',
      undefined,
      { headers: undefined },
    );
    expect(createPlainAxiosInstance).toHaveBeenCalledWith();
    expect(mockPlain.get).toHaveBeenCalledWith(
      'https://keres.example/api/public/stories/S1/publications/P1/download?access=abc',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
    expect(mockPlain.get.mock.calls[0][1].headers).toBeUndefined();
  });

  it('reports the progress when the server says how big the file is', async () => {
    mockClient.post.mockResolvedValue(urlReply);
    mockPlain.get.mockImplementation(async (_url: string, config: any) => {
      config.onDownloadProgress({ loaded: 1, total: 4 });
      config.onDownloadProgress({ loaded: 2 });
      return { data: new ArrayBuffer(0) };
    });
    const onProgress = jest.fn();

    await service.downloadPackage(guest, 'S1', 'P1', null, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(0.25);
  });

  it('copes with a caller that does not want progress', async () => {
    mockClient.post.mockResolvedValue(urlReply);
    mockPlain.get.mockImplementation(async (_url: string, config: any) => {
      config.onDownloadProgress({ loaded: 1, total: 4 });
      return { data: new ArrayBuffer(0) };
    });
    await expect(service.downloadPackage(guest, 'S1', 'P1')).resolves.toEqual(new Uint8Array());
  });

  it('refuses to fetch over plain http from anywhere but the local network', async () => {
    mockClient.post.mockResolvedValue({ data: { url: 'http://elsewhere.example/file.zip' } });

    await expect(service.downloadPackage(guest, 'S1', 'P1')).rejects.toThrow(/local network/);
    expect(mockPlain.get).not.toHaveBeenCalled();
  });
});

describe('the lists of the public site', () => {
  it('lists stories, leaving out the filters that are not set, and reads the total the server sends', async () => {
    mockClient.get.mockResolvedValue({
      data: [{ storyId: 'S1' }],
      headers: { 'x-total-count': '41' },
    });

    const page = await service.listStories(guest, {
      q: 'casa',
      genre: undefined,
      language: '',
      type: 'branching',
      sort: 'title',
      limit: 24,
      offset: 0,
    });

    expect(page).toEqual({ items: [{ storyId: 'S1' }], total: 41 });
    expect(mockClient.get).toHaveBeenCalledWith('/public/stories', {
      params: { q: 'casa', type: 'branching', sort: 'title', limit: 24, offset: 0 },
    });
  });

  it('has no total when the server does not say (another origin cannot read the header)', async () => {
    mockClient.get.mockResolvedValue({ data: [], headers: {} });
    await expect(service.listStories(guest, {})).resolves.toEqual({ items: [], total: null });

    mockClient.get.mockResolvedValue({ data: [], headers: { 'x-total-count': 'many' } });
    await expect(service.listStories(guest, {})).resolves.toEqual({ items: [], total: null });

    mockClient.get.mockResolvedValue({ data: [] });
    await expect(service.listStories(guest, {})).resolves.toEqual({ items: [], total: null });
  });

  it('reads what the list can be filtered by', async () => {
    const facets = {
      genres: [{ value: 'Fantasy', count: 2 }],
      languages: [],
      mediums: [],
      types: [],
    };
    mockClient.get.mockResolvedValue({ data: facets });

    await expect(service.getFacets(registered)).resolves.toEqual(facets);
    expect(mockClient.get).toHaveBeenCalledWith('/public/stories/facets');
  });

  it('lists authors by name', async () => {
    mockClient.get.mockResolvedValue({
      data: [{ owner: { username: 'ana' } }],
      headers: { 'x-total-count': '1' },
    });

    await expect(service.listAuthors(guest, { q: 'an', limit: 48, offset: 0 })).resolves.toEqual({
      items: [{ owner: { username: 'ana' } }],
      total: 1,
    });
    expect(mockClient.get).toHaveBeenCalledWith('/public/authors', {
      params: { q: 'an', limit: 48, offset: 0 },
    });
  });

  it("reads an author's page by the name they publish under", async () => {
    mockClient.get.mockResolvedValue({ data: { owner: { username: 'júlia d' } } });

    await service.getAuthor(guest, 'júlia d');

    expect(mockClient.get).toHaveBeenCalledWith('/public/authors/j%C3%BAlia%20d');
  });

  it('lets an author with nothing to show (a 404) reach the caller', async () => {
    mockClient.get.mockRejectedValue({ response: { status: 404 } });
    await expect(service.getAuthor(guest, 'nobody')).rejects.toEqual({ response: { status: 404 } });
  });
});

describe('showcaseCoverUrl', () => {
  it("is the cover of the story, or of one of its works, under the server's API", () => {
    expect(showcaseCoverUrl(registered, 'S 1')).toBe(
      'https://keres.example/api/public/stories/S%201/cover',
    );
    expect(showcaseCoverUrl({ kind: 'guest', origin: 'https://other.example/' }, 'S1', 'W1')).toBe(
      'https://other.example/api/public/stories/S1/works/W1/cover',
    );
  });
});

describe('packs', () => {
  it('lists the packs on show', async () => {
    mockClient.get.mockResolvedValue({ data: [{ id: 'K1' }] });

    await expect(service.listPacks(guest)).resolves.toEqual([{ id: 'K1' }]);
    expect(mockClient.get).toHaveBeenCalledWith('/public/packs');
  });

  it('hands back a pack with its content checked', async () => {
    mockClient.get.mockResolvedValue({ data: { id: 'K 1', content: { fields: [] } } });

    await expect(service.getPack(guest, 'K 1')).resolves.toEqual({
      id: 'K 1',
      content: { fields: [], valid: true },
    });
    expect(mockClient.get).toHaveBeenCalledWith('/public/packs/K%201');
  });

  it('does not hand over a pack this app cannot read', async () => {
    mockClient.get.mockResolvedValue({ data: { id: 'K1', content: { weird: true } } });
    mockValidatePack.mockImplementation(() => {
      throw new Error('invalid pack');
    });

    await expect(service.getPack(guest, 'K1')).rejects.toThrow('invalid pack');
  });

  it('lets a pack that is not there (a 404) reach the caller', async () => {
    mockClient.get.mockRejectedValue({ response: { status: 404 } });
    await expect(service.getPack(guest, 'nope')).rejects.toEqual({ response: { status: 404 } });
  });
});

describe('downloadManuscript', () => {
  it('asks for the signed address of the manuscript and fetches it with nothing of the session', async () => {
    mockClient.post.mockResolvedValue({
      data: { url: '/api/public/stories/S1/publications/P1/manuscript/download?access=abc' },
    });
    mockPlain.get.mockResolvedValue({ data: new Uint8Array([37, 80, 68, 70]).buffer });

    const bytes = await service.downloadManuscript(guest, 'S1', 'P1', 'tok');

    expect(Array.from(bytes)).toEqual([37, 80, 68, 70]);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/public/stories/S1/publications/P1/manuscript/download-url',
      undefined,
      { headers: { Authorization: 'Showcase tok' } },
    );
    expect(mockPlain.get).toHaveBeenCalledWith(
      'https://other.example/api/public/stories/S1/publications/P1/manuscript/download?access=abc',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });
});
