import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './LoginPage.module.css'

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
      console.log('[LoginPage] Redirect to:', path)
      navigate(path, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    await login(email, password)
  }

  return (
    <div className={styles.loginPage}>
      {/* Background Texture */}
      <div className={styles.loginBg}></div>

      <main className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <header className={styles.loginHeader}>
            <div className={styles.loginLogoWrapper}>
              <div className={styles.loginLogo}>
                
              </div>
            </div>
            <h1 className={styles.loginTitle}>Selamat Datang</h1>
            <p className={styles.loginSubtitle}>Akses sistem manajemen inventaris Anda</p>
          </header>

          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="email">Alamat Email</label>
              <div className={styles.inputWrapper}>
                <input
                  id="email"
                  type="email"
                  className={styles.formInput}
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
                
              </div>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabelRow}>
                <label className={styles.formLabel} htmlFor="password">Kata Sandi</label>
                <a className={styles.forgotLink} href="#">LUPA SANDI?</a>
              </div>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.formInput}
                  placeholder="••••••••"
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
                  <span className="material-symbols-outlined">
                    {showPassword ? '0' : '0'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className={styles.formError}>
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Masuk Sekarang'
              )}
            </button>
          </form>

          <footer className={styles.loginFooter}>
            <p className={styles.loginFooterText}>
              Belum punya akun? <a className={styles.loginFooterLink} href="#">Hubungi Admin</a>
            </p>
            <div className={styles.loginFooterLinks}>
              <a className={styles.loginFooterLinkItem} href="#">
                
                Demo PWA
              </a>
              <span className={styles.loginFooterDivider}></span>
              <a className={styles.loginFooterLinkItem} href="#">
               Bantuan
              </a>
            </div>
          </footer>
        </div>

        <div className={styles.loginCorporate}>
          <p>
            HKI Global Systems Management<br />
            <span>Security Protocol © 2024 Inventory Pro v2.4</span>
          </p>
        </div>
      </main>

      {/* Credentials Demo */}
      
    </div>
  )
}