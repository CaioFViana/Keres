import type { Choice } from '@domain/entities/Choice'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { CreateChoicePayload, UpdateChoicePayload } from '@keres/shared'

import { chapters, choices, scenes, story, db } from '@infrastructure/db'
import { and, eq, like } from 'drizzle-orm'
import { ulid } from 'ulid'

export class ChoiceRepository implements IChoiceRepository {
  async create(data: CreateChoicePayload): Promise<Choice> {
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

  async update(id: string, data: UpdateChoicePayload, sceneId: string): Promise<Choice | null> {
    const [updatedChoice] = await db
      .update(choices)
      .set({
        sceneId: data.sceneId,
        nextSceneId: data.nextSceneId,
        text: data.text,
        updatedAt: new Date(),
      })
      .where(eq(choices.id, id), eq(choices.sceneId, sceneId))
      .returning()
    return updatedChoice || null
  }

  async delete(id: string, sceneId: string): Promise<void> {
    await db.delete(choices).where(eq(choices.id, id), eq(choices.sceneId, sceneId))
  }

  async findBySceneId(sceneId: string): Promise<Choice[]> {
    const result = await db.select().from(choices).where(eq(choices.sceneId, sceneId))
    return result
  }

  async search(query: string, userId: string): Promise<Choice[]> {
    try {
      const results = await db
        .select({ choices: choices })
        .from(choices)
        .innerJoin(scenes, eq(choices.sceneId, scenes.id))
        .innerJoin(chapters, eq(scenes.chapterId, chapters.id))
        .innerJoin(story, eq(chapters.storyId, story.id))
        .where(and(eq(story.userId, userId), like(choices.text, `%${query}%`)))
      return results.map((result: { choices: Choice }) => result.choices)
    } catch (error) {
      console.error('Error in ChoiceRepository.search:', error)
      throw error
    }
  }
}
