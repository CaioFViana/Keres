import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

import { GetMomentsBySceneIdUseCase } from '@application/use-cases/moment/GetMomentsBySceneIdUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockMomentRepository implements IMomentRepository {
  private moments: Moment[] = []

  async findById(id: string): Promise<Moment | null> {
    return this.moments.find((moment) => moment.id === id) || null
  }

  async findBySceneId(sceneId: string): Promise<Moment[]> {
    return this.moments.filter((moment) => moment.sceneId === sceneId)
  }

  async save(moment: Moment): Promise<void> {
    this.moments.push(moment)
  }

  async update(moment: Moment): Promise<void> {
    const index = this.moments.findIndex((m) => m.id === moment.id)
    if (index !== -1) {
      this.moments[index] = moment
    }
  }

  async delete(id: string): Promise<void> {
    this.moments = this.moments.filter((moment) => moment.id !== id)
  }
}

describe('GetMomentsBySceneIdUseCase', () => {
  let momentRepository: MockMomentRepository
  let getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(momentRepository)

    // Pre-populate moments for testing
    momentRepository.save({
      id: 'moment1',
      sceneId: 'scene123',
      name: 'Moment 1',
      location: 'Location A',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    momentRepository.save({
      id: 'moment2',
      sceneId: 'scene123',
      name: 'Moment 2',
      location: 'Location B',
      index: 2,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    momentRepository.save({
      id: 'moment3',
      sceneId: 'scene456',
      name: 'Moment 3',
      location: 'Location C',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return all moments for a given scene ID', async () => {
    const moments = await getMomentsBySceneIdUseCase.execute('scene123')

    expect(moments).toBeDefined()
    expect(moments.length).toBe(2)
    expect(moments[0].name).toBe('Moment 1')
    expect(moments[1].name).toBe('Moment 2')
  })

  it('should return an empty array if no moments found for the scene ID', async () => {
    const moments = await getMomentsBySceneIdUseCase.execute('nonexistent_scene')

    expect(moments).toBeDefined()
    expect(moments.length).toBe(0)
  })
})
