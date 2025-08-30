import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

import { CreateMomentUseCase } from '@application/use-cases/CreateMomentUseCase'
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

describe('CreateMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let createMomentUseCase: CreateMomentUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    createMomentUseCase = new CreateMomentUseCase(momentRepository)
  })

  it('should create a new moment successfully', async () => {
    const momentDTO = {
      sceneId: 'scene123',
      name: 'Moment 1',
      location: 'Location A',
      index: 1,
      summary: 'A summary.',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const momentProfile = await createMomentUseCase.execute(momentDTO)

    expect(momentProfile).toBeDefined()
    expect(momentProfile.name).toBe('Moment 1')
    expect(momentProfile.sceneId).toBe('scene123')
    expect(momentProfile.id).toBeDefined()
    expect(momentProfile.isFavorite).toBe(true)

    const createdMoment = await momentRepository.findById(momentProfile.id)
    expect(createdMoment).toBeDefined()
    expect(createdMoment?.name).toBe('Moment 1')
  })

  it('should create a new moment with default values for optional fields', async () => {
    const momentDTO = {
      sceneId: 'scene456',
      name: 'Moment 2',
      index: 2,
    }

    const momentProfile = await createMomentUseCase.execute(momentDTO)

    expect(momentProfile).toBeDefined()
    expect(momentProfile.name).toBe('Moment 2')
    expect(momentProfile.location).toBeNull()
    expect(momentProfile.summary).toBeNull()
    expect(momentProfile.isFavorite).toBe(false)
    expect(momentProfile.extraNotes).toBeNull()
  })
})
