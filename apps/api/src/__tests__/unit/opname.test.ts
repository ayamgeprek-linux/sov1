// apps/api/src/__tests__/unit/opname.test.ts
import { describe, it, expect, vi } from 'vitest'
import { OpnameService } from '../services/opnameService'

vi.mock('../../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { stock_sistem: 10 }, 
            error: null 
          }))
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: [{ stock_real: 5, selisih: -5, status: 'keluar' }], 
          error: null 
        }))
      }))
    }))
  }
}))

describe('OpnameService', () => {
  const service = new OpnameService()

  it('should calculate selisih correctly', async () => {
    const result = await service.saveOpname({
      sku: 'TEST-001',
      size: 'L',
      qtyFisik: 5,
      userId: 'user-123'
    })

    expect(result.selisih).toBe(-5)
    expect(result.status).toBe('keluar')
  })
})