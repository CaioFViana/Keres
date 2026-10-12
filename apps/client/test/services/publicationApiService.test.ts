/** @jest-environment node */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockSetTokenProvider = jest.fn();
const mockSetActiveServer = jest.fn();

jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  createKeresAxiosInstance: () => ({
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    setTokenProvider: (...args: unknown[]) => mockSetTokenProvider(...args),
    setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args),
  }),
}));

jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));

import {
  PUBLISH_UPLOAD_TIMEOUT_MS,
  publicationApiService,
} from '../../src/services/PublicationApiService';

const server = { id: 'srv-1', name: 'Main', url: 'https://s.example' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: { id: 'pub-1', label: 'v1' } });
});

describe('getPublicConfig', () => {
  it('returns the advertised flags', async () => {
    mockGet.mockResolvedValue({
      data: { showcaseEnabled: true, compiledUpload: true },
    });

    await expect(publicationApiService.getPublicConfig(server)).resolves.toEqual({
      showcaseEnabled: true,
      compiledUpload: true,
    });
    expect(mockGet).toHaveBeenCalledWith('/public/config');
  });

  it('says nothing when the server cannot answer', async () => {
    mockGet.mockRejectedValue(new Error('down'));

    await expect(publicationApiService.getPublicConfig(server)).resolves.toBeUndefined();
  });
});

describe('supportsCompiledUpload', () => {
  it('is true when the server advertises the upload capability', async () => {
    mockGet.mockResolvedValue({ data: { showcaseEnabled: true, compiledUpload: true } });
    await expect(publicationApiService.supportsCompiledUpload(server)).resolves.toBe(true);
  });

  it('is false on older servers and when unreachable', async () => {
    mockGet.mockResolvedValue({ data: { showcaseEnabled: true } });
    await expect(publicationApiService.supportsCompiledUpload(server)).resolves.toBe(false);

    mockGet.mockRejectedValue(new Error('down'));
    await expect(publicationApiService.supportsCompiledUpload(server)).resolves.toBe(false);
  });
});

describe('publish', () => {
  it('posts the legacy JSON body untouched', async () => {
    await publicationApiService.publish(
      server,
      'story-1',
      5,
      'both',
      'public',
      undefined,
      { format: 'md', language: 'en' } as never,
      undefined,
      true,
      undefined,
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/stories/story-1/publications');
    expect(body).toMatchObject({ operationVersion: 5, manuscript: { format: 'md' } });
    expect(body).not.toHaveProperty('data');
    expect(config?.headers?.['Content-Type']).toBeUndefined();
  });
});

describe('publishCompiled', () => {
  const manuscriptBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const readerBytes = new TextEncoder().encode('<!DOCTYPE html><html></html>');

  it('rides the JSON body as the data part with each artifact as a file part', async () => {
    await publicationApiService.publishCompiled(
      server,
      'story-1',
      5,
      'both',
      'public',
      undefined,
      { format: 'pdf', language: 'en' } as never,
      { language: 'en' } as never,
      true,
      undefined,
      {
        manuscript: {
          bytes: manuscriptBytes,
          filename: 'manuscript.pdf',
          mimeType: 'application/pdf',
        },
        reader: { bytes: readerBytes, filename: 'reader.html', mimeType: 'text/html' },
      },
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, form, config] = mockPost.mock.calls[0];
    expect(url).toBe('/stories/story-1/publications');
    expect(config.headers).toMatchObject({ 'Content-Type': 'multipart/form-data' });
    expect(config.timeout).toBe(PUBLISH_UPLOAD_TIMEOUT_MS);
    expect(form).toBeInstanceOf(FormData);

    expect(JSON.parse(form.get('data') as string)).toMatchObject({
      operationVersion: 5,
      labelMode: 'both',
      manuscript: { format: 'pdf' },
      reader: { language: 'en' },
      includePackage: true,
    });
    const manuscript = form.get('manuscript') as File;
    expect(manuscript.name).toBe('manuscript.pdf');
    expect(manuscript.type).toBe('application/pdf');
    expect(manuscript.size).toBe(manuscriptBytes.byteLength);
    const reader = form.get('reader') as File;
    expect(reader.name).toBe('reader.html');
    expect(reader.type).toBe('text/html');
    expect(reader.size).toBe(readerBytes.byteLength);
  });

  it('sends only the artifacts asked for, with a raised timeout and progress', async () => {
    const onUploadProgress = jest.fn();
    const signal = new AbortController().signal;
    await publicationApiService.publishCompiled(
      server,
      'story-1',
      5,
      'both',
      'public',
      undefined,
      { format: 'md', language: 'en' } as never,
      undefined,
      true,
      undefined,
      {
        manuscript: { bytes: manuscriptBytes, filename: 'manuscript.md', mimeType: 'text/markdown' },
      },
      { onUploadProgress, timeoutMs: 60000, signal },
    );

    const [url, form, config] = mockPost.mock.calls[0];
    expect(url).toBe('/stories/story-1/publications');
    expect(form.get('manuscript')).toBeTruthy();
    expect(form.get('reader')).toBeNull();
    expect(config.timeout).toBe(60000);
    expect(config.signal).toBe(signal);

    config.onUploadProgress({ loaded: 1, total: 4 });
    expect(onUploadProgress).toHaveBeenCalledWith(0.25);
  });
});
