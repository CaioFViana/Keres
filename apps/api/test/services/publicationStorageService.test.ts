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
});
