import React, { ReactNode, useState, useEffect } from 'react'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { StatusBar } from '../StatusBar'
import styles from './PrivateLayout.module.css'

interface PrivateLayoutProps {
  children: ReactNode
  currentPage: string
  navigateTo: (page: string) => void
  userRole: 'admin' | 'petugas'
  onLogout: () => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function PrivateLayout({
  children,
  currentPage,
  navigateTo,
  userRole,
  onLogout,
  isSidebarOpen,
  onToggleSidebar,
}: PrivateLayoutProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle quick search based on role
  const handleQuickSearch = () => {
    if (userRole === 'admin') {
      navigateTo('master')
    } else {
      navigateTo('petugas-so')
    }
  }

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        <Sidebar
          currentPage={currentPage}
          navigateTo={navigateTo}
          userRole={userRole}
          onLogout={onLogout}
          isOpen={isSidebarOpen}
          onClose={onToggleSidebar}
        />
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        <Topbar
          userRole={userRole}
          onToggleSidebar={onToggleSidebar}
          onQuickSearch={handleQuickSearch}
          userName={userRole === 'admin' ? 'Budi Santoso' : 'Rina Pratiwi'}
          isMobile={isMobile}
        />
        <div className={styles.content}>{children}</div>
        <StatusBar />
      </div>
    </div>
  )
}