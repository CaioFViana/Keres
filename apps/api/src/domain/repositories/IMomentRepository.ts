import { Moment } from '@domain/entities/Moment';

export interface IMomentRepository {
  findById(id: string): Promise<Moment | null>;
  findBySceneId(sceneId: string): Promise<Moment[]>;
  save(moment: Moment): Promise<void>;
  update(moment: Moment): Promise<void>;
  delete(id: string): Promise<void>;
}
