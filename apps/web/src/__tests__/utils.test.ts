// apps/web/src/__tests__/unit/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate, getStatusBadge } from '../../utils/helpers'

describe('Helpers', () => {
  it('should format date correctly', () => {
    const date = '2026-07-12T10:30:00Z'
    const result = formatDate(date)
    expect(result).toBe('12 Jul 2026')
  })

  it('should return correct status badge', () => {
    expect(getStatusBadge('sesuai')).toEqual({ 
      label: '✅ Sesuai', 
      className: 'statusMatch' 
    })
    expect(getStatusBadge('keluar')).toEqual({ 
      label: '⬇️ Minus', 
      className: 'statusMinus' 
    })
    expect(getStatusBadge('masuk')).toEqual({ 
      label: '⬆️ Plus', 
      className: 'statusPlus' 
    })
  })
})