import { CreateUserDTO, UserProfileDTO } from '@application/dtos/UserDTOs';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IPasswordHasherService } from '@domain/services/IPasswordHasherService';
import { User } from '@domain/entities/User';
import { ulid } from 'ulid';

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasherService
  ) {}

  async execute(data: CreateUserDTO): Promise<UserProfileDTO> {
    const existingUser = await this.userRepository.findByUsername(data.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.passwordHasher.hash(data.password);
    const passwordSalt = 'some_salt'; // In a real app, generate a unique salt per user

    const newUser: User = {
      id: ulid(),
      username: data.username,
      passwordHash,
      passwordSalt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepository.save(newUser);

    return {
      id: newUser.id,
      username: newUser.username,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }
}
