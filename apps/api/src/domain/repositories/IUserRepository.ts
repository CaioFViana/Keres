import type { User } from '@domain/entities/User'

export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  save(user: User): Promise<void>
  update(user: User): Promise<void>
  delete(id: string): Promise<void>
}
