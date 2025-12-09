import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Search,
  Filter,
  ChevronDown,
  FileText,
  Eye,
  Trash2,
  Upload,
  Calendar,
  Loader2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type DPR } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState<DPR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const dprs = await api.getDPRs()
      setDocuments(dprs)
    } catch (err) {
      setError('Failed to load documents')
      console.error('Error loading documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.deleteDPR(id)
      setDocuments(documents.filter(doc => doc.id !== id))
    } catch (err) {
      alert('Failed to delete document')
      console.error('Error deleting document:', err)
    }
  }

  const getDocumentStatus = (doc: DPR) => {
    if (doc.summary_json) {
      return { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50' }
    }
    return { label: 'Processing', color: 'text-blue-600', bg: 'bg-blue-50' }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const completedCount = documents.filter(d => d.summary_json).length
  const processingCount = documents.length - completedCount

  const stats = [
    { label: 'Total Documents', value: documents.length.toString(), color: 'text-primary' },
    { label: 'Completed', value: completedCount.toString(), color: 'text-green-600' },
    { label: 'Processing', value: processingCount.toString(), color: 'text-gray-500' },
    { label: 'Total Files', value: documents.length.toString(), color: 'text-primary' },
  ]

  const filteredDocuments = documents.filter(doc =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('documents.title')}</h1>
            <p className="text-muted-foreground">{t('documents.subtitle')}</p>
          </div>
          <Button size="lg" onClick={() => navigate('/')}>
            <Upload className="h-4 w-4" />
            {t('common.upload')}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('documents.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            All Documents
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            Upload Date
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 mb-6">
            {error}
          </div>
        )}

        {!loading && !error && filteredDocuments.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Upload your first DPR document to get started'}
            </p>
            <Button onClick={() => navigate('/')}>
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const status = getDocumentStatus(doc)
            return (
              <Card key={doc.id} className="p-6 hover:border-primary/40 transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1 line-clamp-2">{doc.original_filename}</h3>
                    <div className={`inline-flex text-xs px-2 py-1 rounded-full ${status.bg} ${status.color} font-medium`}>
                      {status.label}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(doc.upload_ts)}
                  </div>
                  {doc.client_email && (
                    <div className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <span className="truncate max-w-[200px]" title={doc.client_email}>{doc.client_email}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    disabled={!doc.summary_json}
                  >
                    <Eye className="h-4 w-4" />
                    View Analysis
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
