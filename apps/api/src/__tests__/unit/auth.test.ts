// apps/api/src/__tests__/unit/auth.test.ts
import { describe, it, expect } from 'vitest'
import { loginSchema } from '../../routes/auth'

describe('Auth Validation', () => {
  it('should validate valid login data', () => {
    const validData = { email: 'test@example.com', password: 'password123' }
    const result = loginSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const invalidData = { email: 'invalid-email', password: 'password123' }
    const result = loginSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  it('should reject short password', () => {
    const invalidData = { email: 'test@example.com', password: '123' }
    const result = loginSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})