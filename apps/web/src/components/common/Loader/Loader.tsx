import React from 'react'
import styles from './Loader.module.css'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export function Loader({ size = 'md', fullScreen = false }: LoaderProps) {
  const classes = [
    styles.loader,
    styles[`loader__${size}`],
    fullScreen ? styles['loader__fullscreen'] : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className={styles.loader__spinner}></div>
    </div>
  )
}