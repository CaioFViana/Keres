import type { IJwtService } from '@domain/services/IJwtService'

import jwt from 'jsonwebtoken'

export class JwtService implements IJwtService {
  private readonly secret: string

  constructor() {
    // In a real application, this secret should be loaded from environment variables
    // and be a strong, randomly generated string.
    this.secret = process.env.JWT_SECRET || 'supersecretjwtkey'
    if (this.secret === 'supersecretjwtkey') {
      console.warn('JWT_SECRET is not set in environment variables. Using default secret.')
    }
  }

  async generateToken(payload: object, expiresIn: string): Promise<string> {
    return jwt.sign(payload, this.secret, { expiresIn })
  }

  async verifyToken(token: string): Promise<object | null> {
    try {
      return jwt.verify(token, this.secret) as object
    } catch (error) {
      return null // Token is invalid or expired
    }
  }
}
