// apps/api/src/__tests__/integration/api.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../app'

describe('API Integration', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body.status).toBe('ok')
    expect(response.body.service).toBe('StockOpname API')
  })

  it('should reject invalid login', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'invalid@example.com', password: 'wrong' })
      .expect(401)

    expect(response.body.success).toBe(false)
  })
})