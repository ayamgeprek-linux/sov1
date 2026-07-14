export class AuthValidator {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static validatePassword(password: string): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (password.length < 6) {
      errors.push('Password minimal 6 karakter')
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password harus mengandung huruf kapital')
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password harus mengandung huruf kecil')
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password harus mengandung angka')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  static validateLoginForm(email: string, password: string): {
    valid: boolean
    errors: Record<string, string>
  } {
    const errors: Record<string, string> = {}

    if (!email || email.trim() === '') {
      errors.email = 'Email wajib diisi'
    } else if (!this.validateEmail(email)) {
      errors.email = 'Format email tidak valid'
    }

    if (!password || password.trim() === '') {
      errors.password = 'Password wajib diisi'
    } else if (password.length < 6) {
      errors.password = 'Password minimal 6 karakter'
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    }
  }
}