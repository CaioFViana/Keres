import type { User } from '@domain/entities/User'
import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IJwtService } from '@domain/services/IJwtService'
import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'

import { AuthenticateUserUseCase } from '@application/use-cases/user/AuthenticateUserUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementations (re-using from CreateUserUseCase.test.ts for simplicity)
class MockUserRepository implements IUserRepository {
  private users: User[] = []

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) || null
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((user) => user.username === username) || null
  }

  async save(user: User): Promise<void> {
    this.users.push(user)
  }

  async update(user: User): Promise<void> {
    const index = this.users.findIndex((u) => u.id === user.id)
    if (index !== -1) {
      this.users[index] = user
    }
  }

  async delete(id: string): Promise<void> {
    this.users = this.users.filter((user) => user.id !== id)
  }
}

class MockPasswordHasherService implements IPasswordHasherService {
  async hash(password: string): Promise<string> {
    return `hashed_${password}`
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return `hashed_${password}` === hashedPassword
  }
}

class MockJwtService implements IJwtService {
  async generateToken(payload: any, expiresIn: string): Promise<string> {
    return 'mock_token'
  }

  async verifyToken(token: string): Promise<any> {
    return { userId: 'user123', username: 'testuser' }
  }
}

describe('AuthenticateUserUseCase', () => {
  let userRepository: MockUserRepository
  let passwordHasher: MockPasswordHasherService
  let jwtService: MockJwtService
  let authenticateUserUseCase: AuthenticateUserUseCase

  beforeEach(() => {
    userRepository = new MockUserRepository()
    passwordHasher = new MockPasswordHasherService()
    jwtService = new MockJwtService()
    authenticateUserUseCase = new AuthenticateUserUseCase(
      userRepository,
      passwordHasher,
      jwtService,
    )

    // Pre-populate a user for authentication tests
    userRepository.save({
      id: 'user123',
      username: 'testuser',
      passwordHash: 'hashed_password123',
      passwordSalt: 'some_salt',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should authenticate a user with valid credentials', async () => {
    const authDTO = {
      username: 'testuser',
      password: 'password123',
    }

    const userProfile = await authenticateUserUseCase.execute(authDTO)

    expect(userProfile).toBeDefined()
    expect(userProfile?.username).toBe('testuser')
  })

  it('should return null for invalid username', async () => {
    const authDTO = {
      username: 'nonexistentuser',
      password: 'password123',
    }

    const userProfile = await authenticateUserUseCase.execute(authDTO)

    expect(userProfile).toBeNull()
  })

  it('should return null for invalid password', async () => {
    const authDTO = {
      username: 'testuser',
      password: 'wrongpassword',
    }

    const userProfile = await authenticateUserUseCase.execute(authDTO)

    expect(userProfile).toBeNull()
  })
})
