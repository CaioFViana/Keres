export interface User {
  id: string
  username: string
  passwordHash: string
  passwordSalt: string
  createdAt: Date
  updatedAt: Date
}
