import React, { ReactNode } from 'react'
import styles from './Button.module.css'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  onClick,
  type = 'button',
  disabled = false,
  children,
  className = '',
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[`button__${variant}`],
    styles[`button__${size}`],
    full && styles['button__full'],
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}