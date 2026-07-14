// apps/web/src/__tests__/unit/auth.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginPage } from '../../auth/components/LoginPage'

describe('LoginPage', () => {
  it('should render login form', () => {
    render(<LoginPage />)
    expect(screen.getByText('Selamat Datang')).toBeDefined()
    expect(screen.getByPlaceholderText('nama@perusahaan.com')).toBeDefined()
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined()
  })

  it('should show error on empty submit', async () => {
    const mockLogin = vi.fn()
    render(<LoginPage login={mockLogin} />)
    
    const submitBtn = screen.getByRole('button', { name: /Masuk Sekarang/i })
    fireEvent.click(submitBtn)
    
    // Should show validation error
    expect(screen.getByText(/Email tidak valid/i)).toBeDefined()
  })
})