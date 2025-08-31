export interface IJwtService {
  generateToken(payload: object, expiresIn: string): Promise<string>;
  verifyToken(token: string): Promise<object | null>;
}