import type { WorldRule } from '@domain/entities/WorldRule';

export interface IWorldRuleRepository {
  findById(id: string): Promise<WorldRule | null>;
  findByStoryId(storyId: string): Promise<WorldRule[]>;
  save(worldRule: WorldRule): Promise<void>;
  update(worldRule: WorldRule): Promise<void>;
  delete(id: string): Promise<void>;
}