import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteGalleryUseCase } from '@application/use-cases/DeleteGalleryUseCase';
import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';
import { Gallery } from '@domain/entities/Gallery';

// Mock implementation
class MockGalleryRepository implements IGalleryRepository {
  private galleryItems: Gallery[] = [];

  async findById(id: string): Promise<Gallery | null> {
    return this.galleryItems.find(item => item.id === id) || null;
  }

  async findByStoryId(storyId: string): Promise<Gallery[]> {
    return this.galleryItems.filter(item => item.storyId === storyId);
  }

  async findByOwnerId(ownerId: string): Promise<Gallery[]> {
    return this.galleryItems.filter(item => item.ownerId === ownerId);
  }

  async save(gallery: Gallery): Promise<void> {
    this.galleryItems.push(gallery);
  }

  async update(gallery: Gallery): Promise<void> {
    const index = this.galleryItems.findIndex(item => item.id === gallery.id);
    if (index !== -1) {
      this.galleryItems[index] = gallery;
    }
  }

  async delete(id: string): Promise<void> {
    this.galleryItems = this.galleryItems.filter(item => item.id !== id);
  }
}

describe('DeleteGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository;
  let deleteGalleryUseCase: DeleteGalleryUseCase;

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository();
    deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository);

    // Pre-populate a gallery item for testing
    galleryRepository.save({
      id: 'gal123',
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/image.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should delete an existing gallery item successfully', async () => {
    const deleted = await deleteGalleryUseCase.execute('gal123', 'story123');
    expect(deleted).toBe(true);

    const gallery = await galleryRepository.findById('gal123');
    expect(gallery).toBeNull();
  });

  it('should return false if gallery item not found', async () => {
    const deleted = await deleteGalleryUseCase.execute('nonexistent_gal', 'story123');
    expect(deleted).toBe(false);
  });

  it('should return false if gallery item does not belong to the specified story', async () => {
    const deleted = await deleteGalleryUseCase.execute('gal123', 'another_story');
    expect(deleted).toBe(false);

    // Ensure the gallery item was not deleted
    const gallery = await galleryRepository.findById('gal123');
    expect(gallery).toBeDefined();
  });
});
