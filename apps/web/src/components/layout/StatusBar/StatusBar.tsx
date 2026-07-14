import React, { useState, useEffect } from 'react'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      setTime(`${h}:${m}`)
    }
    updateClock()
    const interval = setInterval(updateClock, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.statusBar}>
      <div className={styles.statusBarLeft}>
        <span className={styles.statusBarDot}></span>
        <span>System Online</span>
      </div>
      <div className={styles.statusBarRight}>
        <div className={styles.statusBarSync}>
          <i className="fa-solid fa-database"></i>
          <span>SYNC</span>
        </div>
        <div className={styles.statusBarDivider}></div>
        <div className={styles.statusBarClock}>{time}</div>
      </div>
    </div>
  )
}