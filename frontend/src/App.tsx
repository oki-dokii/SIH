import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import IndexPage from './pages/Index'
import DocumentsPage from './pages/Documents'
import DocumentDetailPage from './pages/DocumentDetail'
import ComparisonsPage from './pages/Comparisons'
import ComparisonDetailPage from './pages/ComparisonDetail'

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/comparisons" element={<ComparisonsPage />} />
          <Route path="/comparison-chat/:id/detail" element={<ComparisonDetailPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App
