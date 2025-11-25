import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import IndexPage from './pages/Index'
import ProjectsPage from './pages/Projects'
import ProjectDetailPage from './pages/ProjectDetail'
import DocumentDetailPage from './pages/DocumentDetail'
import ComparisonsPage from './pages/Comparisons'
import ComparisonDetailPage from './pages/ComparisonDetail'

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/documents" element={<Navigate to="/projects" replace />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/comparisons" element={<ComparisonsPage />} />
          <Route path="/comparison-chat/:id/detail" element={<ComparisonDetailPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App
