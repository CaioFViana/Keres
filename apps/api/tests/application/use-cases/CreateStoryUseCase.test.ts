import { describe, it, expect, beforeEach } from 'vitest';
import { CreateStoryUseCase } from '@application/use-cases/CreateStoryUseCase';
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

describe('CreateStoryUseCase', () => {
  let storyRepository: MockStoryRepository;
  let createStoryUseCase: CreateStoryUseCase;

  beforeEach(() => {
    storyRepository = new MockStoryRepository();
    createStoryUseCase = new CreateStoryUseCase(storyRepository);
  });

  it('should create a new story successfully', async () => {
    const storyDTO = {
      userId: 'user123',
      title: 'My First Story',
      summary: 'A short summary.',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    };

    const storyProfile = await createStoryUseCase.execute(storyDTO);

    expect(storyProfile).toBeDefined();
    expect(storyProfile.title).toBe('My First Story');
    expect(storyProfile.userId).toBe('user123');
    expect(storyProfile.id).toBeDefined();
    expect(storyProfile.isFavorite).toBe(true);

    const createdStory = await storyRepository.findById(storyProfile.id);
    expect(createdStory).toBeDefined();
    expect(createdStory?.title).toBe('My First Story');
  });

  it('should create a new story with default values for optional fields', async () => {
    const storyDTO = {
      userId: 'user456',
      title: 'Another Story',
    };

    const storyProfile = await createStoryUseCase.execute(storyDTO);

    expect(storyProfile).toBeDefined();
    expect(storyProfile.title).toBe('Another Story');
    expect(storyProfile.summary).toBeNull();
    expect(storyProfile.genre).toBeNull();
    expect(storyProfile.language).toBeNull();
    expect(storyProfile.isFavorite).toBe(false);
    expect(storyProfile.extraNotes).toBeNull();
  });
});
