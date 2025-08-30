import { Story } from '@domain/entities/Story';

export interface IStoryRepository {
  findById(id: string): Promise<Story | null>;
  findByUserId(userId: string): Promise<Story[]>;
  save(story: Story): Promise<void>;
  update(story: Story): Promise<void>;
  delete(id: string): Promise<void>;
}
