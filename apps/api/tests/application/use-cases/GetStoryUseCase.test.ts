import { describe, it, expect, beforeEach } from 'vitest';
import { GetStoryUseCase } from '@application/use-cases/GetStoryUseCase';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';
import { Story } from '@domain/entities/Story';

// Mock implementation
class MockStoryRepository implements IStoryRepository {
  private stories: Story[] = [];

  async findById(id: string): Promise<Story | null> {
    return this.stories.find(story => story.id === id) || null;
  }

  async findByUserId(userId: string): Promise<Story[]> {
    return this.stories.filter(story => story.userId === userId);
  }

  async save(story: Story): Promise<void> {
    this.stories.push(story);
  }

  async update(story: Story): Promise<void> {
    const index = this.stories.findIndex(s => s.id === story.id);
    if (index !== -1) {
      this.stories[index] = story;
    }
  }

  async delete(id: string): Promise<void> {
    this.stories = this.stories.filter(story => story.id !== id);
  }
}

describe('GetStoryUseCase', () => {
  let storyRepository: MockStoryRepository;
  let getStoryUseCase: GetStoryUseCase;

  beforeEach(() => {
    storyRepository = new MockStoryRepository();
    getStoryUseCase = new GetStoryUseCase(storyRepository);

    // Pre-populate a story for testing
    storyRepository.save({
      id: 'story123',
      userId: 'user123',
      title: 'Test Story',
      summary: 'A summary',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return a story profile for a valid ID', async () => {
    const storyProfile = await getStoryUseCase.execute('story123');

    expect(storyProfile).toBeDefined();
    expect(storyProfile?.id).toBe('story123');
    expect(storyProfile?.title).toBe('Test Story');
  });

  it('should return null for an invalid story ID', async () => {
    const storyProfile = await getStoryUseCase.execute('nonexistent');

    expect(storyProfile).toBeNull();
  });
});
