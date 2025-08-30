import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'

import * as bcrypt from 'bcrypt'

export class BcryptPasswordHasher implements IPasswordHasherService {
  private readonly saltRounds: number

  constructor(saltRounds: number = 10) {
    this.saltRounds = saltRounds
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds)
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }
}
