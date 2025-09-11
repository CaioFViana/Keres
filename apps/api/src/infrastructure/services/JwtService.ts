import type { IJwtService } from '@domain/services/IJwtService'

import jwt, { SignOptions } from 'jsonwebtoken'

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
    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(payload, this.secret, options)
  }

  async verifyToken(token: string): Promise<object | null> {
    try {
      return jwt.verify(token, this.secret) as object
    } catch (_error) {
      return null // Token is invalid or expired
    }
  }

  async generateRefreshToken(payload: object, expiresIn: string): Promise<string> {
    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(payload, this.secret, options)
  }

  async verifyRefreshToken(token: string): Promise<object | null> {
    try {
      return jwt.verify(token, this.secret) as object
    } catch (_error) {
      return null // Token is invalid or expired
    }
  }
}