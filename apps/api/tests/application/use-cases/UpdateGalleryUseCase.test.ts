import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateGalleryUseCase } from '@application/use-cases/UpdateGalleryUseCase';
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

describe('UpdateGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository;
  let updateGalleryUseCase: UpdateGalleryUseCase;

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository();
    updateGalleryUseCase = new UpdateGalleryUseCase(galleryRepository);

    // Pre-populate a gallery item for testing
    galleryRepository.save({
      id: 'gal123',
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/original.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should update an existing gallery item successfully', async () => {
    const updateDTO = {
      id: 'gal123',
      storyId: 'story123',
      imagePath: 'http://example.com/updated.jpg',
      isFavorite: true,
    };

    const updatedGallery = await updateGalleryUseCase.execute(updateDTO);

    expect(updatedGallery).toBeDefined();
    expect(updatedGallery?.imagePath).toBe('http://example.com/updated.jpg');
    expect(updatedGallery?.isFavorite).toBe(true);
    expect(updatedGallery?.extraNotes).toBe('Original Notes'); // Should remain unchanged
  });

  it('should return null if gallery item not found', async () => {
    const updateDTO = {
      id: 'nonexistent_gal',
      storyId: 'story123',
      imagePath: 'http://example.com/new.jpg',
    };

    const updatedGallery = await updateGalleryUseCase.execute(updateDTO);

    expect(updatedGallery).toBeNull();
  });

  it('should return null if gallery item does not belong to the specified story', async () => {
    const updateDTO = {
      id: 'gal123',
      storyId: 'another_story',
      imagePath: 'http://example.com/new.jpg',
    };

    const updatedGallery = await updateGalleryUseCase.execute(updateDTO);

    expect(updatedGallery).toBeNull();

    // Ensure the gallery item was not updated
    const gallery = await galleryRepository.findById('gal123');
    expect(gallery?.imagePath).toBe('http://example.com/original.jpg');
  });
});
