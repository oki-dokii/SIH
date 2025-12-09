import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { RoleProvider, useRole } from './contexts/RoleContext'
import DPRLandingPage from './pages/DPRLandingPage'
import IndexPage from './pages/Index'
import ProjectsPage from './pages/Projects'
import ProjectDetailPage from './pages/ProjectDetail'
import PDFAnalysis from './pages/PDFAnalysis'

// Protected Route Component for admin-only access
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useRole()
  const location = useLocation()

  // Wait for auth state to be restored from localStorage
  if (isLoading) {
    return null // or a loading spinner if desired
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useRole()

  return (
    <Routes>
      {/* Landing Page at root - only show if not authenticated */}
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/home" replace /> : <DPRLandingPage />
        }
      />

      {/* Protected Admin Routes */}
      <Route path="/home" element={<ProtectedRoute><IndexPage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
      <Route path="/documents" element={<Navigate to="/projects" replace />} />
      <Route path="/pdf/:id/analysis" element={<ProtectedRoute><PDFAnalysis /></ProtectedRoute>} />

      {/* Fallback - redirect to appropriate page based on auth */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/home" : "/"} replace />} />
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

