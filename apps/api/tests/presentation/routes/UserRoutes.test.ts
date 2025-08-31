/// <reference types="vitest/globals" />
import { ulid } from 'ulid'
import app from '@keres/api/src/index'
import { db, users } from '@keres/db'
import { beforeEach, describe, expect, it } from 'vitest'

describe('UserRoutes Integration', () => {
  beforeEach(async () => {
    // Clear the users table before each test
    await db.delete(users)
  })

  it('should register a new user', async () => {
    const response = await app.request('/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser_integration',
        password: 'password123',
      }),
    })

    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toHaveProperty('id')
    expect(data.username).toBe('testuser_integration')
  })

  it('should not register a user with existing username', async () => {
    // Register first user
    await app.request('/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'duplicate_user',
        password: 'password123',
      }),
    })

    // Try to register again with same username
    const response = await app.request('/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'duplicate_user',
        password: 'password123',
      }),
    })

    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Username already exists')
  })

  it('should authenticate an existing user', async () => {
    // Register user first
    await app.request('/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'auth_user',
        password: 'auth_password',
      }),
    })

    // Authenticate
    const response = await app.request('/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'auth_user',
        password: 'auth_password',
      }),
    })

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
    expect(data.username).toBe('auth_user')
  })

  it('should not authenticate with invalid credentials', async () => {
    const response = await app.request('/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent',
        password: 'wrong',
      }),
    })

    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid credentials')
  })

  it('should get user profile by ID', async () => {
    // Register user first to get an ID
    const registerResponse = await app.request('/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'profile_user',
        password: 'profile_password',
      }),
    })
    const registeredUser = await registerResponse.json()
    const userId = registeredUser.id

    const response = await app.request(`/users/profile/${userId}`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe(userId)
    expect(data.username).toBe('profile_user')
  })

  it('should return 404 for non-existent user profile', async () => {
    const nonExistentUserId = ulid()
    const response = await app.request(`/users/profile/${nonExistentUserId}`)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('User not found')
  })
})
