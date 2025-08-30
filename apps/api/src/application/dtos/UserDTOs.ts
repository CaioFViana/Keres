export interface CreateUserDTO {
  username: string
  password: string
}

export interface AuthenticateUserDTO {
  username: string
  password: string
}

export interface UserProfileDTO {
  id: string
  username: string
  createdAt: Date
  updatedAt: Date
}
