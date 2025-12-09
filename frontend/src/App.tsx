import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { RoleProvider, useRole } from './contexts/RoleContext'
import { loadGoogleTranslateScript, initGoogleTranslate } from './lib/googleTranslate'
import { useEffect } from 'react'
import RoleSelectionPage from './pages/RoleSelection'
import DPRLandingPage from './pages/DPRLandingPage'
import AdminLogin from './pages/AdminLogin'
import UserAuth from './pages/UserAuth'
import IndexPage from './pages/Index'
import ProjectsPage from './pages/Projects'
import ProjectDetailPage from './pages/ProjectDetail'
import DocumentDetailPage from './pages/DocumentDetail'
import ComparisonsPage from './pages/Comparisons'
import ComparisonDetailPage from './pages/ComparisonDetail'
import ClientDashboard from './pages/ClientDashboard'


function RoleSelectionWithNav() {
  const { setRole, logout, logoutUser } = useRole()
  const navigate = useNavigate()

  const handleRoleSelect = (newRole: 'admin' | 'user') => {
    // Clear any existing authentication
    logout()
    logoutUser()

    // Set the new role
    setRole(newRole)

    // Navigate to appropriate login page
    if (newRole === 'admin') {
      navigate('/admin/login')
    } else {
      navigate('/user/auth')
    }
  }

  return <RoleSelectionPage onRoleSelect={handleRoleSelect} />
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role, isLoading } = useRole()
  const location = useLocation()

  // Wait for auth state to be restored from localStorage
  if (isLoading) {
    return null // or a loading spinner if desired
  }

  if (!isAuthenticated || role !== 'admin') {
    return <Navigate to="/role-selection" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { role, isAuthenticated, userInfo } = useRole()

  return (
    <Routes>
      {/* Landing Page at root */}
      <Route path="/" element={<DPRLandingPage />} />

      {/* Role Selection */}
      <Route path="/role-selection" element={<RoleSelectionWithNav />} />

      {/* Admin Login - redirect if already logged in */}
      <Route
        path="/admin/login"
        element={
          isAuthenticated && role === 'admin'
            ? <Navigate to="/admin" replace />
            : <AdminLogin />
        }
      />

      {/* User Auth - redirect if already logged in */}
      <Route
        path="/user/auth"
        element={
          userInfo && role === 'user'
            ? <Navigate to="/user/dashboard" replace />
            : <UserAuth />
        }
      />

      {/* User Routes */}
      <Route path="/user/dashboard" element={<ClientDashboard />} />

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><IndexPage /></ProtectedRoute>} />
      <Route path="/admin/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/admin/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
      <Route path="/admin/documents/:id" element={<ProtectedRoute><DocumentDetailPage /></ProtectedRoute>} />
      <Route path="/admin/comparisons" element={<ProtectedRoute><ComparisonsPage /></ProtectedRoute>} />
      <Route path="/admin/comparison-chat/:id/detail" element={<ProtectedRoute><ComparisonDetailPage /></ProtectedRoute>} />

      {/* Fallback - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  useEffect(() => {
    // Load Google Translate script on app mount
    loadGoogleTranslateScript()
      .then(() => {
        console.log('✓ Google Translate loaded')
        initGoogleTranslate()
      })
      .catch((err: Error) => {
        console.error('✗ Failed to load Google Translate:', err)
      })
  }, [])

  return (
    <RoleProvider>
      <LanguageProvider>
        <BrowserRouter>
          {/* Hidden Google Translate widget */}
          <div id="google_translate_element" style={{ display: 'none' }}></div>

          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </RoleProvider>
  )
}

export default App