import { Context, Next } from 'hono';
import { JwtService } from '@infrastructure/services/JwtService';

const jwtService = new JwtService();

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await jwtService.verifyToken(token);
    if (!decoded) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
    // Attach decoded payload to context for later use in routes
    c.set('jwtPayload', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401);
  }
};