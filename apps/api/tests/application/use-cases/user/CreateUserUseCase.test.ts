import type { User } from '@domain/entities/User'
import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'

import { CreateUserUseCase } from '@application/use-cases/user/CreateUserUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementations
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
  async generateSalt(): Promise<string> {
    return 'mock_salt' // Mock implementation for generateSalt
  }

  async hash(password: string, salt: string): Promise<string> {
    return `hashed_${password}_${salt}`
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    // This mock assumes the salt is part of the hashedPassword for simplicity
    return hashedPassword.startsWith(`hashed_${password}`)
  }
}

describe('CreateUserUseCase', () => {
  let userRepository: MockUserRepository
  let passwordHasher: MockPasswordHasherService
  let createUserUseCase: CreateUserUseCase

  beforeEach(() => {
    userRepository = new MockUserRepository()
    passwordHasher = new MockPasswordHasherService()
    createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher)
  })

  it('should create a new user successfully', async () => {
    const userDTO = {
      username: 'testuser',
      password: 'password123',
    }

    const userProfile = await createUserUseCase.execute(userDTO)

    expect(userProfile).toBeDefined()
    expect(userProfile.username).toBe('testuser')
    expect(userProfile.id).toBeDefined()

    const createdUser = await userRepository.findByUsername('testuser')
    expect(createdUser).toBeDefined()
    expect(createdUser?.passwordHash).toBe('hashed_password123_mock_salt')
  })

  it('should throw an error if username already exists', async () => {
    const userDTO = {
      username: 'existinguser',
      password: 'password123',
    }

    await createUserUseCase.execute(userDTO) // Create the first user

    await expect(createUserUseCase.execute(userDTO)).rejects.toThrow('Username already exists')
  })
})
