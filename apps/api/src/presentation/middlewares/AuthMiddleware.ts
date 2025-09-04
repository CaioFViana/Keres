import type { Context, Next } from 'hono'

import { JwtService } from '@infrastructure/services/JwtService'

const jwtService = new JwtService()

// Keres' fixed user. Please never change this
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES' // Define a fixed user ID for offline mode

export const authMiddleware = async (c: Context, next: Next) => {
  const isOfflineMode = process.env.OFFLINE_MODE === 'true'

  if (isOfflineMode) {
    // In offline mode, bypass JWT verification and set a fixed user ID
    c.set('jwtPayload', { userId: OFFLINE_USER_ID })
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = await jwtService.verifyToken(token)
    if (!decoded) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401)
    }
    // Attach decoded payload to context for later use in routes
    c.set('jwtPayload', decoded)
    await next()
  } catch (error) {
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401)
  }
}
