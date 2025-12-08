import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { RoleProvider, useRole } from './contexts/RoleContext'
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

function UserComingSoon() {
  const { setRole, logout } = useRole()

  const handleSwitchRole = () => {
    logout()
    setRole(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-primary">DPR Analyzer</span>
          </div>
          <button
            onClick={handleSwitchRole}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Switch Role
          </button>
        </div>
      </header>

      {/* Coming Soon Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-muted flex items-center justify-center">
            <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">User View Coming Soon</h2>
          <p className="text-muted-foreground">
            We're working on the user interface. Please check back later or switch to admin view.
          </p>
        </div>
      </main>
    </div>
  )
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useRole()
  const location = useLocation()

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
            ? <Navigate to="/admin/projects" replace />
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

      <Route path="/user/*" element={<UserComingSoon />} />

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
  return (
    <RoleProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </RoleProvider>
  )
}

export default App
