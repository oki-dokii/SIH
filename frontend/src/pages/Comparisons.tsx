import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Calendar, ArrowRight, Loader2, Search } from 'lucide-react'
import { api, Comparison, DPR } from '../lib/api'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export default function ComparisonsPage() {
  const navigate = useNavigate()
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Comparisons</h1>
            <p className="text-gray-600 mt-2">Compare multiple DPRs side-by-side with AI-powered analysis</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Comparison
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : comparisons.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-cyan-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No comparisons yet</h3>
              <p className="text-gray-600 mb-6">
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
                className="p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-cyan-500"
                onClick={() => navigate(`/comparison/${comparison.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {comparison.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
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
                  <ArrowRight className="w-6 h-6 text-cyan-500" />
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
            navigate(`/comparison/${id}`)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Create New Comparison</h2>
          <p className="text-gray-600 mt-1">Select at least 2 documents to compare</p>
        </div>

        <div className="p-6 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comparison Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q1 2024 Projects Comparison"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          />
        </div>

        <div className="p-6 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Documents
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or project name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Documents ({selectedIds.length} selected)
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : filteredDprs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No documents found</p>
          ) : (
            <div className="space-y-2">
              {filteredDprs.map((dpr) => (
                <label
                  key={dpr.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedIds.includes(dpr.id)
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 hover:border-cyan-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(dpr.id)}
                    onChange={() => toggleSelection(dpr.id)}
                    className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {dpr.summary_json?.projectName || dpr.original_filename}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{dpr.original_filename}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
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
