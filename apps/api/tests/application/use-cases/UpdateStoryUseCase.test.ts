import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateStoryUseCase } from '@application/use-cases/UpdateStoryUseCase';
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

describe('UpdateStoryUseCase', () => {
  let storyRepository: MockStoryRepository;
  let updateStoryUseCase: UpdateStoryUseCase;

  beforeEach(() => {
    storyRepository = new MockStoryRepository();
    updateStoryUseCase = new UpdateStoryUseCase(storyRepository);

    // Pre-populate a story for testing
    storyRepository.save({
      id: 'story123',
      userId: 'user123',
      title: 'Original Title',
      summary: 'Original Summary',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should update an existing story successfully', async () => {
    const updateDTO = {
      id: 'story123',
      userId: 'user123',
      title: 'Updated Title',
      isFavorite: true,
    };

    const updatedStory = await updateStoryUseCase.execute(updateDTO);

    expect(updatedStory).toBeDefined();
    expect(updatedStory?.title).toBe('Updated Title');
    expect(updatedStory?.isFavorite).toBe(true);
    expect(updatedStory?.summary).toBe('Original Summary'); // Should remain unchanged
  });

  it('should return null if story not found', async () => {
    const updateDTO = {
      id: 'nonexistent_story',
      userId: 'user123',
      title: 'New Title',
    };

    const updatedStory = await updateStoryUseCase.execute(updateDTO);

    expect(updatedStory).toBeNull();
  });

  it('should return null if user does not own the story', async () => {
    const updateDTO = {
      id: 'story123',
      userId: 'another_user',
      title: 'New Title',
    };

    const updatedStory = await updateStoryUseCase.execute(updateDTO);

    expect(updatedStory).toBeNull();
  });
});
