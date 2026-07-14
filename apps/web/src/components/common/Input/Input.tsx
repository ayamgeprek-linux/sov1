import React from 'react'
import styles from './Input.module.css'

interface InputProps {
  label?: string
  placeholder?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: 'text' | 'number' | 'password' | 'email'
  required?: boolean
  error?: string | null
  className?: string
  disabled?: boolean
  min?: number
  max?: number
}

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  required = false,
  error = null,
  className = '',
  disabled = false,
  min,
  max,
}: InputProps) {
  const classes = [
    styles.input__group,
    error ? styles['input__group--error'] : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {label && (
        <label className={styles.input__label}>
          {label}
          {required && <span className={styles.input__required}>*</span>}
        </label>
      )}
      <input
        type={type}
        className={styles.input__field}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
      />
      {error && <span className={styles.input__error}>{error}</span>}
    </div>
  )
}