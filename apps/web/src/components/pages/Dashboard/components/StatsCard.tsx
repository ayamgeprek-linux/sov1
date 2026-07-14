import React from 'react'
import styles from '../Dashboard.module.css'

interface StatsCardProps {
  label: string
  value: string | number
  trend?: string
  icon: string | React.ReactNode
  color?: 'default' | 'emerald' | 'orange' | 'highlight'
  subtitle?: string
  progress?: number
  actionLabel?: string
  onAction?: () => void
}

export function StatsCard({
  label,
  value,
  trend,
  icon,
  color = 'default',
  subtitle,
  progress,
  actionLabel,
  onAction,
}: StatsCardProps) {
  const isIconString = typeof icon === 'string'

  return (
    <div className={`${styles.stat} ${styles[`stat__${color}`]}`}>
      <div className={styles.statContent}>
        <div>
          <div className={styles.statLabel}>{label}</div>
          <div className={styles.statNumber}>{value}</div>
          {trend && (
            <div className={`${styles.statTrend} ${styles[`statTrend__${color}`]}`}>
              <i className={`fa-solid ${color === 'orange' ? 'fa-triangle-exclamation' : 'fa-arrow-trend-up'}`}></i>
              <span>{trend}</span>
            </div>
          )}
          {subtitle && <div className={styles.statSub}>{subtitle}</div>}
          {progress !== undefined && (
            <div className={styles.statProgress}>
              <span>HARI KE-3</span>
              <span className={styles.textAmber}>11 hari lagi</span>
            </div>
          )}
        </div>
        <div className={`${styles.statIcon} ${styles[`statIcon__${color}`]}`}>
          {isIconString ? icon : icon}
        </div>
      </div>
      {actionLabel && (
        <div className={styles.statAction} onClick={onAction}>
          <i className="fa-solid fa-plus"></i>
          <span>{actionLabel}</span>
        </div>
      )}
      {color === 'highlight' && (
        <div className={styles.statRing}>
          <svg viewBox="0 0 42 42">
            <circle cx="21" cy="21" fill="none" r="15" stroke="#27272a" strokeWidth="6"></circle>
            <circle
              cx="21" cy="21" fill="none" r="15"
              stroke="#f59e0b"
              strokeDasharray="94.2"
              strokeDashoffset={94.2 - (94.2 * (progress || 0) / 100)}
              strokeLinecap="round"
              strokeWidth="6"
            ></circle>
          </svg>
          <div className={styles.statRingLabel}>{progress || 0}</div>
        </div>
      )}
    </div>
  )
}