import { describe, it, expect, beforeEach } from 'vitest';
import { GetStoriesByUserIdUseCase } from '@application/use-cases/GetStoriesByUserIdUseCase';
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

describe('GetStoriesByUserIdUseCase', () => {
  let storyRepository: MockStoryRepository;
  let getStoriesByUserIdUseCase: GetStoriesByUserIdUseCase;

  beforeEach(() => {
    storyRepository = new MockStoryRepository();
    getStoriesByUserIdUseCase = new GetStoriesByUserIdUseCase(storyRepository);

    // Pre-populate stories for testing
    storyRepository.save({
      id: 'story1',
      userId: 'user123',
      title: 'User 1 Story 1',
      summary: 'Summary 1',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Notes 1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    storyRepository.save({
      id: 'story2',
      userId: 'user123',
      title: 'User 1 Story 2',
      summary: 'Summary 2',
      genre: 'Sci-Fi',
      language: 'English',
      isFavorite: true,
      extraNotes: 'Notes 2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    storyRepository.save({
      id: 'story3',
      userId: 'user456',
      title: 'User 2 Story 1',
      summary: 'Summary 3',
      genre: 'Drama',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Notes 3',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return all stories for a given user ID', async () => {
    const stories = await getStoriesByUserIdUseCase.execute('user123');

    expect(stories).toBeDefined();
    expect(stories.length).toBe(2);
    expect(stories[0].title).toBe('User 1 Story 1');
    expect(stories[1].title).toBe('User 1 Story 2');
  });

  it('should return an empty array if no stories found for the user ID', async () => {
    const stories = await getStoriesByUserIdUseCase.execute('nonexistent_user');

    expect(stories).toBeDefined();
    expect(stories.length).toBe(0);
  });
});
