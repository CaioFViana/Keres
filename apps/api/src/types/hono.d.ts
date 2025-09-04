import 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    jwtPayload: { userId: string }
  }
}
