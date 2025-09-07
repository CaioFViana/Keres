export interface IJwtService {
  generateToken(payload: object, expiresIn: string): Promise<string>
  verifyToken(token: string): Promise<object | null>
  generateRefreshToken(payload: object, expiresIn: string): Promise<string>
  verifyRefreshToken(token: string): Promise<object | null>
}
