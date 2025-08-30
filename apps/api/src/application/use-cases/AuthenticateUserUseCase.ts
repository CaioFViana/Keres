import { AuthenticateUserDTO, UserProfileDTO } from '@application/dtos/UserDTOs';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IPasswordHasherService } from '@domain/services/IPasswordHasherService';

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasherService
  ) {}

  async execute(data: AuthenticateUserDTO): Promise<UserProfileDTO | null> {
    const user = await this.userRepository.findByUsername(data.username);
    if (!user) {
      return null; // User not found
    }

    const isPasswordValid = await this.passwordHasher.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      return null; // Invalid password
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
