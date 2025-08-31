import type { CreateChoiceDTO, UpdateChoiceDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'

import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import { db } from '@keres/db'
import { choices } from '@keres/db/src/schema'

export class ChoiceRepository implements IChoiceRepository {
  async create(data: CreateChoiceDTO): Promise<Choice> {
    const newChoiceId = ulid()
    const [newChoice] = await db
      .insert(choices)
      .values({
        id: newChoiceId,
        sceneId: data.sceneId,
        nextSceneId: data.nextSceneId,
        text: data.text,
        isImplicit: data.isImplicit ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    return newChoice
  }

  async findById(id: string): Promise<Choice | null> {
    const [choice] = await db.select().from(choices).where(eq(choices.id, id))
    return choice || null
  }

  async update(id: string, data: UpdateChoiceDTO): Promise<Choice | null> {
    const [updatedChoice] = await db
      .update(choices)
      .set({
        sceneId: data.sceneId,
        nextSceneId: data.nextSceneId,
        text: data.text,
        isImplicit: data.isImplicit,
        updatedAt: new Date(),
      })
      .where(eq(choices.id, id))
      .returning()
    return updatedChoice || null
  }

  async delete(id: string): Promise<void> {
    await db.delete(choices).where(eq(choices.id, id))
  }

  async findBySceneId(sceneId: string): Promise<Choice[]> {
    const result = await db.select().from(choices).where(eq(choices.sceneId, sceneId))
    return result
  }
}
