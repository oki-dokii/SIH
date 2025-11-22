import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IndexPage from './pages/Index'
import DocumentsPage from './pages/Documents'
import DocumentDetailPage from './pages/DocumentDetail'
import ComparisonsPage from './pages/Comparisons'
import ComparisonDetailPage from './pages/ComparisonDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/comparisons" element={<ComparisonsPage />} />
        <Route path="/comparison/:id" element={<ComparisonDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
