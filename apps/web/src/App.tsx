// apps/web/src/App.tsx
import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/contexts/AuthContext'
import { LoginPage } from './auth/components/LoginPage'
import { Dashboard } from './components/pages/Dashboard'
import { PetugasDashboard } from './components/pages/PetugasDashboard'
import { ImportPage } from './components/pages/Import'
import { MasterPage } from './components/pages/Master'
import { MappingPage } from './components/pages/Mapping'
import { OpnamePage } from './components/pages/Opname'
import { ProgressPage } from './components/pages/Progress'
import { HistoryPage } from './components/pages/History'
import { ReportPage } from './components/pages/Report'
import { AuditLogPage } from './components/pages/AuditLog/AuditLogPage'
import { BackupPage } from './components/pages/Backup/BackupPage'  // 👈 TAMBAH
import { PrivateLayout } from './components/layout/PrivateLayout'
import { useProducts } from './hooks/useProducts'
import './styles/index.css'

type Page = 
  | 'dashboard' 
  | 'import' 
  | 'master' 
  | 'mapping' 
  | 'sop' 
  | 'progress' 
  | 'history' 
  | 'report'
  | 'audit'
  | 'backup'  // 👈 TAMBAH
  | 'petugas-dashboard' 
  | 'petugas-so' 
  | 'petugas-progress'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { products, refreshProducts } = useProducts()

  const userRole = user?.role || 'admin'
  const userName = user?.name || (userRole === 'admin' ? 'Budi Santoso' : 'Rina Pratiwi')

  const showToast = (message: string) => {
    console.log('[Toast]', message)
  }

  const navigateTo = (page: string) => {
    console.log('[App] Navigate to:', page)
    setCurrentPage(page as Page)
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleLogout = async () => {
    console.log('[App] Logout clicked')
    try {
      await logout()
      console.log('[App] Logout successful')
    } catch (error) {
      console.error('[App] Logout error:', error)
    }
  }

  // CEK APAKAH PAGE UNTUK PETUGAS
  const isPetugasPage = (page: Page): boolean => {
    return page === 'petugas-dashboard' || page === 'petugas-so' || page === 'petugas-progress'
  }

  // CEK APAKAH PAGE UNTUK ADMIN
  const isAdminPage = (page: Page): boolean => {
    return page === 'dashboard' || page === 'import' || page === 'master' || 
           page === 'mapping' || page === 'sop' || page === 'progress' || 
           page === 'history' || page === 'report' || page === 'audit' || page === 'backup'
  }

  const renderPage = () => {
    const commonProps = {
      products,
      navigateTo,
      showToast,
      refreshProducts,
    }

    // ROLE-BASED REDIRECT: kalo petugas coba akses admin page
    if (userRole === 'petugas' && isAdminPage(currentPage) && currentPage !== 'dashboard') {
      return <PetugasDashboard navigateTo={navigateTo} showToast={showToast} userName={userName} />
    }

    // ROLE-BASED REDIRECT: kalo admin coba akses petugas page
    if (userRole === 'admin' && isPetugasPage(currentPage)) {
      return <Dashboard {...commonProps} />
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...commonProps} />
      case 'petugas-dashboard':
        return <PetugasDashboard 
          navigateTo={navigateTo} 
          showToast={showToast} 
          userName={userName} 
        />
      case 'import':
        return <ImportPage navigateTo={navigateTo} showToast={showToast} />
      case 'master':
        return <MasterPage {...commonProps} />
      case 'mapping':
        return <MappingPage {...commonProps} />
      case 'sop':
      case 'petugas-so':
        return <OpnamePage {...commonProps} />
      case 'progress':
      case 'petugas-progress':
        return <ProgressPage {...commonProps} />
      case 'history':
        return <HistoryPage navigateTo={navigateTo} showToast={showToast} />
      case 'report':
        return <ReportPage navigateTo={navigateTo} showToast={showToast} />
      case 'audit':
        return <AuditLogPage navigateTo={navigateTo} showToast={showToast} />
      case 'backup':  // 👈 TAMBAH
        return <BackupPage navigateTo={navigateTo} showToast={showToast} />
      default:
        // Default berdasarkan role
        if (userRole === 'petugas') {
          return <PetugasDashboard navigateTo={navigateTo} showToast={showToast} userName={userName} />
        }
        return <Dashboard {...commonProps} />
    }
  }

  if (isLoading) {
    return (
      <div className="app-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f9fa',
        color: '#735c00',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '16px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        <span className="material-symbols-outlined animate-spin" style={{ marginRight: '12px' }}>progress_activity</span>
        LOADING...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <PrivateLayout
      currentPage={currentPage}
      navigateTo={navigateTo}
      userRole={userRole as 'admin' | 'petugas'}
      onLogout={handleLogout}
      isSidebarOpen={sidebarOpen}
      onToggleSidebar={toggleSidebar}
    >
      {renderPage()}
    </PrivateLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  )
}