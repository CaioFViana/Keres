import { describe, expect, it, vi } from 'vitest';
import { PublicationStorageService } from '../../src/services/PublicationStorageService';

describe('PublicationStorageService', () => {
  it('returns null for a signed URL on a backend that cannot sign', async () => {
    const service = new PublicationStorageService({} as never);

    await expect(service.presignedUrl('story', 'publication', 60)).resolves.toBeNull();
  });

  it('delegates the signed URL to a backend that can sign', async () => {
    const presignGet = vi.fn(async () => 'https://cdn.example/r.zip?sig=1');
    const service = new PublicationStorageService({ presignGet } as never);

    await expect(service.presignedUrl('story', 'publication', 60)).resolves.toBe(
      'https://cdn.example/r.zip?sig=1',
    );
    expect(presignGet).toHaveBeenCalledWith('publications/story/publication.zip', 60);
  });

  it('stores a manuscript under its format extension with the shared content type', async () => {
    const put = vi.fn(async (_key: string, _bytes: ArrayBuffer, _mimeType: string) => {});
    const service = new PublicationStorageService({ put } as never);

    await service.storeManuscript('story', 'publication', new Uint8Array([1, 2, 3]), 'md');

    expect(put).toHaveBeenCalledTimes(1);
    const [key, bytes, mimeType] = put.mock.calls[0];
    expect(key).toBe('publications/story/publication.manuscript.md');
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3]));
    expect(mimeType).toBe('text/markdown');
  });

  it('stores a docx manuscript with the shared extension and content type', async () => {
    const put = vi.fn(async (_key: string, _bytes: ArrayBuffer, _mimeType: string) => {});
    const service = new PublicationStorageService({ put } as never);

    await service.storeManuscript('story', 'publication', new Uint8Array([1]), 'docx');

    const [key, , mimeType] = put.mock.calls[0];
    expect(key).toBe('publications/story/publication.manuscript.docx');
    expect(mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('reads and deletes a manuscript through the same key', async () => {
    const get = vi.fn(async () => 'body');
    const del = vi.fn(async () => undefined);
    const service = new PublicationStorageService({ get, delete: del } as never);

    await expect(service.readManuscript('story', 'publication', 'html')).resolves.toBe('body');
    expect(get).toHaveBeenCalledWith('publications/story/publication.manuscript.html');

    await service.deleteManuscript('story', 'publication', 'html');
    expect(del).toHaveBeenCalledWith('publications/story/publication.manuscript.html');
  });

  it('signs a manuscript URL only on backends that can sign', async () => {
    const unsigned = new PublicationStorageService({} as never);
    await expect(
      unsigned.presignedManuscriptUrl('story', 'publication', 'txt', 60),
    ).resolves.toBeNull();

    const presignGet = vi.fn(async () => 'https://cdn.example/r.manuscript.txt?sig=1');
    const signed = new PublicationStorageService({ presignGet } as never);
    await expect(signed.presignedManuscriptUrl('story', 'publication', 'txt', 60)).resolves.toBe(
      'https://cdn.example/r.manuscript.txt?sig=1',
    );
    expect(presignGet).toHaveBeenCalledWith('publications/story/publication.manuscript.txt', 60);
  });
});
