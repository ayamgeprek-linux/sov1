// apps/web/src/components/pages/Login/LoginPage.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './LoginPage.module.css'

// 🔥 IMPORT GAMBAR DARI src/assets/
import logoSrc from '../../../assets/logo-dsc.png'
import illustrationSrc from '../../../assets/login-illustration.png'

export function LoginPage() {
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role
      const path = role === 'petugas' ? '/petugas-dashboard' : '/dashboard'
      navigate(path, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    await login(email, password)
  }

  const demoAdmin = { email: 'admin@hki.com', password: 'admin123' }
  const demoPetugas = { email: 'petugas@hki.com', password: 'petugas123' }

  const fillDemo = (type: 'admin' | 'petugas') => {
    if (type === 'admin') {
      setEmail(demoAdmin.email)
      setPassword(demoAdmin.password)
    } else {
      setEmail(demoPetugas.email)
      setPassword(demoPetugas.password)
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        {/* HEADER - LOGO IMAGE */}
        <header className={styles.logoHeader}>
          <div className={styles.logoWrapper}>
            <img 
              src={logoSrc}
              alt="DSC Logo"
              className={styles.logoImage}
            />
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className={styles.loginContent}>
          {/* LEFT - ILLUSTRATION IMAGE */}
          <div className={styles.illustrationSide}>
            <div className={styles.imageWrapper}>
              <img 
                src={illustrationSrc}
                alt="Stock Opname Illustration"
                className={styles.loginImage}
              />
            </div>
          </div>

          {/* RIGHT - FORM */}
          <div className={styles.formSide}>
            <form className={styles.loginForm} onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
                </span>
                <input
                  type="email"
                  id="username"
                  placeholder="Username / ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock</span>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Kata Sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {error && (
                <div className={styles.formError}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>error</span>
                  {error}
                </div>
              )}

              <button type="submit" className={styles.btnLogin} disabled={isLoading}>
                {isLoading ? 'LOADING...' : 'LOGIN'}
              </button>
            </form>

           
          </div>
        </main>

        <footer className={styles.loginFooter}>
          <a href="#">Lupa Kata Sandi?</a> <span>Hubungi IT Support</span>
        </footer>
      </div>
    </div>
  )
}