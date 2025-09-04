import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'

import * as bcrypt from 'bcrypt'

export class BcryptPasswordHasher implements IPasswordHasherService {
  private readonly saltRounds: number

  constructor(saltRounds: number = 10) {
    this.saltRounds = saltRounds
  }

  async generateSalt(): Promise<string> {
    return bcrypt.genSalt(this.saltRounds)
  }

  async hash(password: string, salt?: string): Promise<string> {
    if (salt) {
      return bcrypt.hash(password, salt)
    } else {
      return bcrypt.hash(password, this.saltRounds)
    }
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }
}
