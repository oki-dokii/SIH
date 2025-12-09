import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Send, Loader2, ArrowLeft, Calendar, Trash2, X, Plus, Search, MessageSquare } from 'lucide-react'
import { api, Comparison, ComparisonMessage, DPR } from '../lib/api'
import { Header } from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useLanguage } from '../contexts/LanguageContext'
import { ChatMessageFormatter } from '../components/ChatMessageFormatter'
import { formatIndianCurrency } from '../lib/currency'

export default function ComparisonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [messages, setMessages] = useState<ComparisonMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false)
  const [showAddPDFModal, setShowAddPDFModal] = useState(false)
  const [availableDPRs, setAvailableDPRs] = useState<DPR[]>([])
  const [removingDPRId, setRemovingDPRId] = useState<number | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      loadComparison()
      loadChatHistory()
    }
  }, [id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadComparison = async () => {
    try {
      const data = await api.getComparison(Number(id))
      setComparison(data)
    } catch (error) {
      console.error('Failed to load comparison:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChatHistory = async () => {
    try {
      const history = await api.getComparisonChatHistory(Number(id))
      setMessages(history)
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleClearChat = () => {
    setShowClearChatConfirm(true)
  }

  const confirmClearChat = async () => {
    if (!id) return

    try {
      await api.clearComparisonChatHistory(Number(id))
      setMessages([])
      setShowClearChatConfirm(false)
    } catch (error) {
      console.error('Failed to clear chat:', error)
      alert('Failed to clear chat history')
    }
  }

  const loadAvailableDPRs = async () => {
    try {
      const allDPRs = await api.getDPRs()
      const currentDPRIds = comparison?.dprs?.map(d => d.id) || []
      setAvailableDPRs(allDPRs.filter(dpr => !currentDPRIds.includes(dpr.id)))
    } catch (error) {
      console.error('Failed to load available DPRs:', error)
    }
  }

  const handleRemoveDPR = async (dprId: number) => {
    if (!id) return

    try {
      setRemovingDPRId(dprId)
      await api.removeDPRFromComparison(Number(id), dprId)
      await loadComparison()
      setShowRemoveConfirm(null)
    } catch (error) {
      console.error('Failed to remove DPR:', error)
      alert('Failed to remove PDF from comparison')
    } finally {
      setRemovingDPRId(null)
    }
  }

  const handleAddDPR = async (dprId: number) => {
    if (!id) return

    try {
      await api.addDPRToComparison(Number(id), dprId)
      await loadComparison()
      setShowAddPDFModal(false)
      setSearchQuery('')
    } catch (error) {
      console.error('Failed to add DPR:', error)
      alert('Failed to add PDF to comparison')
    }
  }

  const handleSend = async () => {
    if (!inputMessage.trim() || sending) return

    const userMessage: ComparisonMessage = {
      id: Date.now(),
      comparison_id: Number(id),
      role: 'user',
      text: inputMessage,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage('')
    setSending(true)

    try {
      const response = await api.sendComparisonMessage(Number(id), inputMessage)
      setMessages((prev) => [...prev, response])
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    )
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Comparison not found</h2>
            <p className="text-gray-600 mb-6">The comparison you're looking for doesn't exist.</p>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Comparisons
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('comparisons.backToComparisons')}
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{comparison.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{comparison.dprs?.length || 0} documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(comparison.created_ts).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Three-column layout: Sidebar | Table | Chat */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - DPR Selection List */}
          <div className="col-span-3">
            <Card className="p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('comparisons.documentsInComparison')}</h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {comparison.dprs?.map((dpr) => (
                  <div
                    key={dpr.id}
                    className="relative group p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
                    onClick={() => navigate(`/admin/documents/${dpr.id}`)}
                  >
                    {/* Remove button - only show when 3+ PDFs */}
                    {comparison.dprs && comparison.dprs.length >= 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowRemoveConfirm(dpr.id)
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                        title="Remove from comparison"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}

                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {dpr.summary_json?.projectName || dpr.original_filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{dpr.original_filename}</p>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => {
                  loadAvailableDPRs()
                  setShowAddPDFModal(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add PDF to Comparison
              </Button>

              <div className="mt-6 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>💡 Tips:</strong>
                  <br />
                  Compare DPRs using the table or ask AI questions
                </p>
              </div>
            </Card>
          </div>

          {/* Center - Comparison Table */}
          <div className={`transition-all duration-300 ${isChatOpen ? 'col-span-5' : 'col-span-9'}`}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">DPR Comparison</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {isChatOpen ? 'Hide Chat' : 'Show Chat'}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                      <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">DPR Name</th>
                      <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Quality Score</th>
                      <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Compliance</th>
                      <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Timeline</th>
                      <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.dprs?.map((dpr, index) => {
                      const data = dpr.summary_json
                      const qualityScore = data?.overallScore ?? null
                      const complianceScore = data?.mdonerComplianceScoring?.overallComplianceScore ?? null
                      const timeline = data?.timelineAnalysis?.implementationDurationMonths ?? null
                      const cost = data?.financialAnalysis?.projectCost?.totalInitialInvestmentLakhINR ?? null

                      const getScoreColor = (score: number | null) => {
                        if (score === null) return 'text-gray-400'
                        if (score >= 80) return 'text-green-600 dark:text-green-400'
                        if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
                        return 'text-red-600 dark:text-red-400'
                      }

                      return (
                        <tr
                          key={dpr.id}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'
                            }`}
                        >
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {data?.projectName || dpr.original_filename}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dpr.original_filename}</p>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-semibold ${getScoreColor(qualityScore)}`}>
                              {qualityScore !== null ? `${qualityScore}/100` : '-'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-semibold ${getScoreColor(complianceScore)}`}>
                              {complianceScore !== null ? `${complianceScore}/100` : '-'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {timeline !== null ? `${timeline} months` : '-'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {cost !== null ? formatIndianCurrency(cost) : '-'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {(!comparison.dprs || comparison.dprs.length === 0) && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">No DPRs in this comparison yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        loadAvailableDPRs()
                        setShowAddPDFModal(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First DPR
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right - Toggleable Chat Pane */}
          {isChatOpen && (
            <div className="col-span-4 animate-in slide-in-from-right duration-300">
              <Card className="flex flex-col h-[calc(100vh-200px)] sticky top-6">
                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">{t('comparisons.aiChat')}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearChat}
                        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                        title={t('common.clearChat')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChatOpen(false)}
                      className="h-8 w-8 p-0"
                      title="Close chat"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Start comparing documents</h3>
                      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
                        Ask questions to compare these documents, find differences, or get insights across all of them.
                      </p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <ChatMessageFormatter key={index} text={message.text} isUser={message.role === 'user'} />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={t('documentDetail.askQuestion')}
                      disabled={sending}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <Button onClick={handleSend} disabled={!inputMessage.trim() || sending}>
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Clear Chat Confirmation Modal */}
        {showClearChatConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-semibold mb-2">Clear Chat History?</h3>
              <p className="text-muted-foreground mb-6">
                This will permanently delete all messages in this comparison chat. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowClearChatConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={confirmClearChat}
                >
                  Clear Chat
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Remove PDF Confirmation Modal */}
        {showRemoveConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-semibold mb-2">Remove PDF from Comparison?</h3>
              <p className="text-muted-foreground mb-6">
                This will remove the PDF from this comparison. The PDF itself will not be deleted.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowRemoveConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleRemoveDPR(showRemoveConfirm)}
                  disabled={removingDPRId === showRemoveConfirm}
                >
                  {removingDPRId === showRemoveConfirm ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove PDF'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Add PDF Modal */}
        {showAddPDFModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-xl font-bold">Add PDF to Comparison</h2>
                <button onClick={() => setShowAddPDFModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-muted-foreground mb-4 shrink-0">
                Select a PDF to add to this comparison.
              </p>

              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search PDFs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mb-6">
                {availableDPRs
                  .filter(dpr =>
                    dpr.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    dpr.summary_json?.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(dpr => (
                    <div
                      key={dpr.id}
                      onClick={() => handleAddDPR(dpr.id)}
                      className="p-3 rounded-lg border cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <p className="font-medium text-sm truncate">
                        {dpr.summary_json?.projectName || dpr.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{dpr.original_filename}</p>
                    </div>
                  ))}
                {availableDPRs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No PDFs available to add
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setShowAddPDFModal(false)}>
                Cancel
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
