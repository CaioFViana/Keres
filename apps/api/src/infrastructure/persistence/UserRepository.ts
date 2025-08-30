import type { User } from '@domain/entities/User'
import type { IUserRepository } from '@domain/repositories/IUserRepository'

import { db, users } from '@keres/db'
import { eq } from 'drizzle-orm'

export class UserRepository implements IUserRepository {
  constructor() {
    console.log('UserRepository constructor called.')
  }

  async findById(id: string): Promise<User | null> {
    console.log('UserRepository.findById called.')
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in UserRepository.findById:', error)
      throw error // Re-throw to propagate the error
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    console.log('UserRepository.findByUsername called.')
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in UserRepository.findByUsername:', error)
      throw error
    }
  }

  async save(user: User): Promise<void> {
    console.log('UserRepository.save called.')
    try {
      await db.insert(users).values(this.toPersistence(user))
    } catch (error) {
      console.error('Error in UserRepository.save:', error)
      throw error
    }
  }

  async update(user: User): Promise<void> {
    console.log('UserRepository.update called.')
    try {
      await db.update(users).set(this.toPersistence(user)).where(eq(users.id, user.id))
    } catch (error) {
      console.error('Error in UserRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    console.log('UserRepository.delete called.')
    try {
      await db.delete(users).where(eq(users.id, id))
    } catch (error) {
      console.error('Error in UserRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof users.$inferSelect): User {
    console.log('UserRepository.toDomain called.')
    return {
      id: data.id,
      username: data.username,
      passwordHash: data.passwordHash,
      passwordSalt: data.passwordSalt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(user: User): typeof users.$inferInsert {
    console.log('UserRepository.toPersistence called.')
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
