import { describe, it, expect, beforeEach } from 'vitest';
import { GetUserProfileUseCase } from '@application/use-cases/GetUserProfileUseCase';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { User } from '@domain/entities/User';

// Mock implementation
class MockUserRepository implements IUserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find(user => user.username === username) || null;
  }

  async save(user: User): Promise<void> {
    this.users.push(user);
  }

  async update(user: User): Promise<void> {
    const index = this.users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.users[index] = user;
    }
  }

  async delete(id: string): Promise<void> {
    this.users = this.users.filter(user => user.id !== id);
  }
}

describe('GetUserProfileUseCase', () => {
  let userRepository: MockUserRepository;
  let getUserProfileUseCase: GetUserProfileUseCase;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    getUserProfileUseCase = new GetUserProfileUseCase(userRepository);

    // Pre-populate a user for profile tests
    userRepository.save({
      id: 'user123',
      username: 'testuser',
      passwordHash: 'hashed_password',
      passwordSalt: 'some_salt',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return user profile for a valid user ID', async () => {
    const userId = 'user123';
    const userProfile = await getUserProfileUseCase.execute(userId);

    expect(userProfile).toBeDefined();
    expect(userProfile?.id).toBe(userId);
    expect(userProfile?.username).toBe('testuser');
  });

  it('should return null for an invalid user ID', async () => {
    const userId = 'nonexistentuser';
    const userProfile = await getUserProfileUseCase.execute(userId);

    expect(userProfile).toBeNull();
  });
});
