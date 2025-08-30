import { describe, it, expect, beforeEach } from 'vitest';
import { GetGalleryByStoryIdUseCase } from '@application/use-cases/GetGalleryByStoryIdUseCase';
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

describe('GetGalleryByStoryIdUseCase', () => {
  let galleryRepository: MockGalleryRepository;
  let getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase;

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository();
    getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(galleryRepository);

    // Pre-populate gallery items for testing
    galleryRepository.save({
      id: 'gal1',
      storyId: 'story123',
      ownerId: 'char1',
      imagePath: 'path/to/image1.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    galleryRepository.save({
      id: 'gal2',
      storyId: 'story123',
      ownerId: 'loc1',
      imagePath: 'path/to/image2.png',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    galleryRepository.save({
      id: 'gal3',
      storyId: 'story456',
      ownerId: 'char2',
      imagePath: 'path/to/image3.gif',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return all gallery items for a given story ID', async () => {
    const galleryItems = await getGalleryByStoryIdUseCase.execute('story123');

    expect(galleryItems).toBeDefined();
    expect(galleryItems.length).toBe(2);
    expect(galleryItems[0].imagePath).toBe('path/to/image1.jpg');
    expect(galleryItems[1].imagePath).toBe('path/to/image2.png');
  });

  it('should return an empty array if no gallery items found for the story ID', async () => {
    const galleryItems = await getGalleryByStoryIdUseCase.execute('nonexistent_story');

    expect(galleryItems).toBeDefined();
    expect(galleryItems.length).toBe(0);
  });
});
