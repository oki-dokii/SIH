import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Calendar, ArrowRight, Loader2, Search, Trash2 } from 'lucide-react'
import { api, Comparison, DPR } from '../lib/api'
import { Header } from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useLanguage } from '../contexts/LanguageContext'

export default function ComparisonsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadComparisons()
  }, [])

  const loadComparisons = async () => {
    try {
      setLoading(true)
      const data = await api.getComparisons()
      setComparisons(data)
    } catch (error) {
      console.error('Failed to load comparisons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() // Prevent navigation
    if (!confirm(t('comparisons.deleteConfirm') || 'Are you sure you want to delete this comparison?')) return

    try {
      await api.deleteComparison(id)
      setComparisons(prev => prev.filter(c => c.id !== id))
    } catch (error) {
      console.error('Failed to delete comparison:', error)
      alert('Failed to delete comparison')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('comparisons.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('comparisons.subtitle')}</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('comparisons.newComparison')}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : comparisons.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No comparisons yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first comparison to analyze multiple DPRs together and get comparative insights
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-5 h-5 mr-2" />
                Create Comparison
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {comparisons.map((comparison) => (
              <Card
                key={comparison.id}
                className="p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-cyan-500 group"
                onClick={() => navigate(`/admin/comparison-chat/${comparison.id}/detail`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {comparison.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{comparison.dpr_count || 0} documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(comparison.created_ts)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(e, comparison.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                    <ArrowRight className="w-6 h-6 text-cyan-500" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateComparisonModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(id) => {
            setShowCreateModal(false)
            navigate(`/admin/comparison-chat/${id}/detail`)
          }}
        />
      )}
    </div>
  )
}

function CreateComparisonModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: number) => void }) {
  const [dprs, setDprs] = useState<DPR[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDPRs()
  }, [])

  const loadDPRs = async () => {
    try {
      const data = await api.getDPRs()
      setDprs(data)
    } catch (error) {
      console.error('Failed to load DPRs:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.length < 2) return

    try {
      setCreating(true)
      const result = await api.createComparison(name, selectedIds)
      onSuccess(result.comparison_id)
    } catch (error) {
      console.error('Failed to create comparison:', error)
      alert('Failed to create comparison. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const filteredDprs = dprs.filter(dpr =>
    dpr.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dpr.summary_json?.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Comparison</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Select at least 2 documents to compare</p>
        </div>

        <div className="p-6 border-b dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Comparison Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q1 2024 Projects Comparison"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div className="p-6 border-b dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Documents
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or project name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Documents ({selectedIds.length} selected)
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : filteredDprs.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No documents found</p>
          ) : (
            <div className="space-y-2">
              {filteredDprs.map((dpr) => (
                <label
                  key={dpr.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedIds.includes(dpr.id)
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(dpr.id)}
                    onChange={() => toggleSelection(dpr.id)}
                    className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {dpr.summary_json?.projectName || dpr.original_filename}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{dpr.original_filename}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || selectedIds.length < 2 || creating}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Comparison'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
