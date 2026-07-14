import React, { useEffect, useState } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  duration?: number
  onClose?: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      if (onClose) onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div className={`${styles.toast} ${styles[`toast__${type}`]}`}>
      <span className={styles.toast__text}>{message}</span>
    </div>
  )
}