import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IndexPage from './pages/Index'
import DocumentsPage from './pages/Documents'
import DocumentDetailPage from './pages/DocumentDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/document/:id" element={<DocumentDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
