import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EnvironmentalImpact } from '@/components/EnvironmentalImpact'
import { FinancialCharts } from '@/components/FinancialCharts'
import { ChatMessageFormatter } from '@/components/ChatMessageFormatter'
import { LocationMap } from '@/components/LocationMap'
import { PDFViewer } from '@/components/PDFViewer'
import { createClickablePageLinks } from '@/utils/parsePageReferences'
import { formatIndianCurrency } from '@/lib/currency'
import {
  ArrowLeft,
  Download,
  DollarSign,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  MessageSquare,
  Send,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  Shield,
  Copy,
  Check,
  Trash2,
  X,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api, type DPR, type Message } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function DocumentDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('overview')
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [document, setDocument] = useState<DPR | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false)
  const [pdfPage, setPdfPage] = useState(1)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(true)
  const [isChatCollapsed, setIsChatCollapsed] = useState(true)
  const [leftWidth, setLeftWidth] = useState(50) // Percentage width of left panel
  const [isResizing, setIsResizing] = useState(false)

  // Get project_id from navigation state or document
  const projectId = (location.state as any)?.projectId || document?.project_id

  useEffect(() => {
    if (id) {
      loadDocument(parseInt(id))
      loadChatHistory(parseInt(id))
    }
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function loadDocument(dprId: number) {
    try {
      setLoading(true)
      const doc = await api.getDPR(dprId)
      setDocument(doc)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  async function loadChatHistory(dprId: number) {
    try {
      const history = await api.getChatHistory(dprId)
      setChatHistory(history)
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }

  function handleClearChat() {
    if (!id) return
    setShowClearChatConfirm(true)
  }

  async function confirmClearChat() {
    if (!id) return

    try {
      await api.clearChatHistory(parseInt(id))
      setChatHistory([])
      setShowClearChatConfirm(false)
    } catch (err) {
      console.error('Failed to clear chat:', err)
      // Optional: show toast error
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatMessage.trim() || !id || chatLoading) return

    const userMessage = chatMessage.trim()
    setChatMessage('')
    setChatLoading(true)

    const tempUserMsg: Message = {
      id: Date.now(),
      dpr_id: parseInt(id),
      role: 'user',
      text: userMessage,
      timestamp: new Date().toISOString(),
    }
    setChatHistory(prev => [...prev, tempUserMsg])

    try {
      const response = await api.sendChatMessage(parseInt(id), userMessage)
      setChatHistory(prev => [...prev, response])
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setChatLoading(false)
    }
  }

  function handleDownload() {
    if (id) {
      const link = window.document.createElement('a')
      link.href = `/api/dpr/${id}/report`
      link.download = `DPR_Report_${id}_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/documents/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePageClick(page: number) {
    setPdfPage(page)
    // Open PDF viewer if it's collapsed
    if (isPdfCollapsed) {
      setIsPdfCollapsed(false)
    }
    // Scroll PDF viewer into view if needed
    setTimeout(() => {
      const pdfViewerElement = window.document.getElementById('pdf-viewer-container')
      if (pdfViewerElement) {
        pdfViewerElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 100) // Small delay to allow PDF viewer to render if it was collapsed
  }

  // Resize handler for draggable divider
  const startResize = () => {
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const containerWidth = window.innerWidth - 100 // Account for padding
      const newLeftWidth = (e.clientX / containerWidth) * 100

      // Limit between 30% and 70%
      if (newLeftWidth >= 30 && newLeftWidth <= 70) {
        setLeftWidth(newLeftWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.document.addEventListener('mousemove', handleMouseMove)
      window.document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.document.removeEventListener('mousemove', handleMouseMove)
      window.document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const tabs = [
    { id: 'overview', label: t('documentDetail.overview') },
    { id: 'analysis', label: t('documentDetail.analysis') },
    { id: 'timeline', label: t('documentDetail.timeline') },
    { id: 'riskAssessment', label: t('documentDetail.riskAssessment') },
    { id: 'inconsistencies', label: t('documentDetail.inconsistencies') },
    { id: 'compliance', label: t('documentDetail.compliance') },
    { id: 'recommendations', label: t('documentDetail.recommendations') },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold mb-2">Document Not Found</h2>
            <p className="text-muted-foreground mb-6">
              {error || 'The requested document could not be found.'}
            </p>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back to Documents
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  const data = document.summary_json

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{document.original_filename}</h1>
            <p className="text-muted-foreground">
              Uploaded on {new Date(document.upload_ts).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={handleShare}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copied!' : t('common.share')}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            {t('common.download')}
          </Button>
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            {data.overallScore && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  {t('documentDetail.overallScore')}
                </div>
                <div className="text-2xl font-bold text-primary">{data.overallScore}/100</div>
              </Card>
            )}
            {data.financialAnalysis?.projectCost?.totalInitialInvestmentLakhINR && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign className="h-4 w-4" />
                  {t('documentDetail.totalInvestment')}
                </div>
                <div className="text-xl font-bold">{formatIndianCurrency(data.financialAnalysis.projectCost.totalInitialInvestmentLakhINR)}</div>
              </Card>
            )}
            {data.timelineAnalysis?.implementationDurationMonths && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  {t('documentDetail.implementationDuration')}
                </div>
                <div className="text-xl font-bold">{data.timelineAnalysis.implementationDurationMonths} {t('documentDetail.months')}</div>
              </Card>
            )}
            {data.projectLocation?.state && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <MapPin className="h-4 w-4" />
                  {t('documentDetail.location')}
                </div>
                <div className="text-lg font-bold">{data.projectLocation.state}</div>
              </Card>
            )}
            {data.recommendation && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  {data.recommendation.toLowerCase().includes('approved') ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : data.recommendation.toLowerCase().includes('rejected') ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {t('documentDetail.recommendation')}
                </div>
                <div className="text-sm font-bold">{data.recommendation}</div>
              </Card>
            )}
            {data.projectSector && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  {t('documentDetail.sector')}
                </div>
                <div className="text-sm font-bold line-clamp-2">{data.projectSector}</div>
              </Card>
            )}
          </div>
        )}

        <div className="grid gap-6 relative" style={{ gridTemplateColumns: isPdfCollapsed && isChatCollapsed ? '1fr' : `${leftWidth}% 4px ${100 - leftWidth}%` }}>
          <div>
            <Card>
              <div className="border-b overflow-x-auto">
                <div className="flex min-w-max">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-4 py-3 font-medium transition-colors whitespace-nowrap',
                        activeTab === tab.id
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {activeTab === 'overview' && (
                  <OverviewTab data={data} onPageClick={handlePageClick} />
                )}

                {activeTab === 'analysis' && (
                  <AnalysisTab data={data} onPageClick={handlePageClick} />
                )}

                {activeTab === 'timeline' && (
                  <TimelineTab data={data} onPageClick={handlePageClick} />
                )}

                {activeTab === 'riskAssessment' && (
                  <RiskAssessmentTab data={data} onPageClick={handlePageClick} />
                )}

                {activeTab === 'inconsistencies' && (
                  <InconsistenciesTab data={data} onPageClick={handlePageClick} />
                )}


                {activeTab === 'compliance' && (() => {
                  console.log('🔍 Rendering ComplianceTab with projectId:', projectId, 'from location:', (location.state as any)?.projectId, 'from document:', document?.project_id)
                  return <ComplianceTab data={data} onPageClick={handlePageClick} projectId={projectId} />
                })()}

                {activeTab === 'recommendations' && (
                  <RecommendationsTab data={data} onPageClick={handlePageClick} />
                )}
              </div>
            </Card>
          </div>

          {/* Draggable Resize Handle */}
          {!(isPdfCollapsed && isChatCollapsed) && (
            <div
              onMouseDown={startResize}
              className={`cursor-col-resize flex items-center justify-center group ${isResizing ? 'bg-primary' : 'hover:bg-primary/20'} transition-colors`}
              title="Drag to resize"
            >
              <div className="w-1 h-full bg-border group-hover:bg-primary transition-colors rounded-full"></div>
            </div>
          )}

          {!(isPdfCollapsed && isChatCollapsed) && (
            <div className="lg:col-span-1 flex flex-col gap-4">
              {/* PDF Viewer */}
              {!isPdfCollapsed ? (
                <div id="pdf-viewer-container" className="relative animate-in fade-in slide-in-from-right duration-300">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPdfCollapsed(true)}
                    className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
                    title="Hide PDF Viewer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <PDFViewer
                    pdfUrl={`http://127.0.0.1:8000/dpr/${id}/pdf`}
                    initialPage={pdfPage}
                    onPageChange={(page) => setPdfPage(page)}
                    className="h-[550px]"
                  />
                </div>
              ) : null}

              {/* Chat Window */}
              {!isChatCollapsed ? (
                <Card className="h-[550px] flex flex-col relative animate-in fade-in slide-in-from-right duration-300">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsChatCollapsed(true)}
                    className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
                    title="Hide Chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="border-b p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{t('documentDetail.chat')}</h3>
                    </div>
                    {chatHistory.length > 0 && (
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
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm">
                          Hello! I'm your DPR analysis assistant. Ask me anything about this document.
                        </p>
                      </div>
                    )}
                    {chatHistory.map((msg, index) => (
                      <ChatMessageFormatter key={index} text={msg.text} isUser={msg.role === 'user'} />
                    ))}
                    {chatLoading && (
                      <div className="p-3 rounded-lg bg-muted mr-8 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="border-t p-4 flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder={t('documentDetail.askQuestion')}
                      className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={chatLoading}
                    />
                    <Button type="submit" disabled={chatLoading || !chatMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </Card>
              ) : null}
            </div>
          )}
        </div>

        {/* Collapsed Buttons - Fixed on right side */}
        <div className="fixed right-4 top-24 flex flex-col gap-2 z-40">
          {isPdfCollapsed && (
            <Button
              onClick={() => setIsPdfCollapsed(false)}
              className="shadow-lg"
              title="Show PDF Viewer"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          )}
          {isChatCollapsed && (
            <Button
              onClick={() => setIsChatCollapsed(false)}
              className="shadow-lg"
              title="Show Chat"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
          )}
        </div>
      </main>

      {/* Clear Chat Confirmation Modal */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-2">{t('common.confirmClearChat')}</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to clear the chat history? This action cannot be undone.
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
    </div>
  )
}

function OverviewTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  const { t } = useLanguage()

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {data.projectName && (
        <div>
          <h3 className="text-2xl font-bold mb-2">{data.projectName}</h3>
        </div>
      )}

      {data.projectLocation && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t('documentDetail.location')}
          </h4>
          <p className="text-muted-foreground mb-3">
            {data.projectLocation.state}
            {data.projectLocation.districts && data.projectLocation.districts.length > 0 && (
              <> - {data.projectLocation.districts.join(', ')}</>
            )}
          </p>
          <LocationMap
            state={data.projectLocation.state}
            districts={data.projectLocation.districts}
            height="250px"
          />
        </div>
      )}

      {data.executiveSummary && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('documentDetail.executiveSummary')}
          </h4>
          <p className="text-muted-foreground leading-relaxed">
            {createClickablePageLinks(data.executiveSummary, onPageClick)}
          </p>
        </div>
      )}
      {data.scopeAndObjectives.mission && (
        <div>
          <h4 className="font-semibold mb-2">{t('documentDetail.mission')}</h4>
          <p className="text-muted-foreground">{data.scopeAndObjectives.mission}</p>
        </div>
      )}

      {data.scopeAndObjectives.objectives && data.scopeAndObjectives.objectives.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">{t('documentDetail.objectives')}</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {data.scopeAndObjectives.objectives.map((obj: string, idx: number) => (
              <li key={idx}>{obj}</li>
            ))}
          </ul>
        </div>
      )}
      {data.financialAnalysis?.returnsAndCoverage && (
        <div className="grid md:grid-cols-2 gap-4">
          {data.financialAnalysis.returnsAndCoverage.avgDSCR && (
            <Card className="p-4 bg-cyan-50 dark:bg-cyan-950">
              <div className="text-sm text-muted-foreground mb-1">{t('documentDetail.avgDSCR')}</div>
              <div className="text-3xl font-bold text-primary">{data.financialAnalysis.returnsAndCoverage.avgDSCR}</div>
            </Card>
          )}
          {data.financialAnalysis.returnsAndCoverage.IRRPercent && (
            <Card className="p-4 bg-cyan-50 dark:bg-cyan-950">
              <div className="text-sm text-muted-foreground mb-1">{t('documentDetail.irr')}</div>
              <div className="text-3xl font-bold text-primary">{data.financialAnalysis.returnsAndCoverage.IRRPercent}%</div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TimelineTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  const { t } = useLanguage()

  if (!data?.timelineAnalysis) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No timeline data available</p>
      </div>
    )
  }

  const timeline = data.timelineAnalysis

  return (
    <div className="space-y-6">
      {timeline.implementationDurationMonths && (
        <Card className="p-6 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950">
          <div className="flex items-center gap-4">
            <Clock className="h-10 w-10 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">{t('documentDetail.implementationDuration')}</div>
              <div className="text-3xl font-bold">{timeline.implementationDurationMonths} {t('documentDetail.months')}</div>
            </div>
          </div>
        </Card>
      )}

      {timeline.milestones && timeline.milestones.length > 0 && (
        <div>
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('documentDetail.keyMilestones')}
          </h4>
          <div className="space-y-3">
            {timeline.milestones.map((milestone: string, idx: number) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-muted-foreground">{milestone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {timeline.operationsCalendar && (
        <div>
          <h4 className="font-semibold mb-2">Operations Calendar</h4>
          <p className="text-muted-foreground">{timeline.operationsCalendar}</p>
        </div>
      )}

      {timeline.timelineRisks && timeline.timelineRisks.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Timeline Risks
          </h4>
          <div className="space-y-2">
            {timeline.timelineRisks.map((risk: string, idx: number) => (
              <div key={idx} className="flex gap-2 items-start p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <XCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AnalysisTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  if (!data?.financialAnalysis) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No analysis data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">Financial Analysis</h3>

      <FinancialCharts data={data} />
    </div>
  )
}

function RiskAssessmentTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  if (!data?.riskAssessment && !data?.environmentalImpact) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No risk assessment data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {data.riskAssessment && data.riskAssessment.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Assessment
          </h4>
          <div className="space-y-3">
            {data.riskAssessment.map((risk: any, idx: number) => (
              <Card key={idx} className={cn(
                'p-4',
                risk.severity === 'High' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                  risk.severity === 'Medium' ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' :
                    'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950'
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-bold',
                    risk.severity === 'High' ? 'bg-red-200 text-red-900 ring-2 ring-red-500' :
                      risk.severity === 'Medium' ? 'bg-orange-200 text-orange-900' :
                        'bg-green-200 text-green-900'
                  )}>
                    {risk.severity}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-bold text-base mb-1 dark:text-gray-100">{risk.riskCategory}</h5>
                    <p className="text-base text-gray-700 dark:text-gray-300 mb-2">
                      {createClickablePageLinks(risk.description, onPageClick)}
                    </p>
                    {risk.evidence && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        Evidence: {createClickablePageLinks(risk.evidence, onPageClick)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.environmentalImpact && (
        <EnvironmentalImpact data={data.environmentalImpact} />
      )}
    </div>
  )
}

function InconsistenciesTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  const inconsistencies = data?.inconsistencyDetection

  if (!inconsistencies || !inconsistencies.hasInconsistencies) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">No Inconsistencies Detected</h3>
        <p className="text-muted-foreground">The DPR appears to be internally consistent</p>
      </div>
    )
  }

  const severityColors = {
    Critical: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
    High: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800',
    Low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
  }

  const categoryIcons = {
    'Budget Mismatch': DollarSign,
    'Timeline Conflict': Clock,
    'Beneficiary Discrepancy': Users,
    'Data Inconsistency': AlertCircle,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Inconsistencies Detected</h3>
          <p className="text-sm text-muted-foreground">
            Found {inconsistencies.totalInconsistenciesFound} issue(s) requiring attention
          </p>
        </div>
        <XCircle className="h-8 w-8 text-red-500" />
      </div>

      <div className="space-y-3">
        {inconsistencies.issues?.map((issue: any, idx: number) => {
          const Icon = categoryIcons[issue.category as keyof typeof categoryIcons] || AlertCircle
          return (
            <Card key={idx} className={`p-4 border-2 ${severityColors[issue.severity as keyof typeof severityColors] || ''}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-base dark:text-gray-100">{issue.category}</h4>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded font-bold',
                      issue.severity === 'Critical' ? 'bg-red-600 text-white ring-2 ring-red-500' :
                        issue.severity === 'High' ? 'bg-orange-600 text-white' :
                          'bg-white dark:bg-gray-800 dark:text-gray-200'
                    )}>{issue.severity}</span>
                  </div>
                  <p className="text-base mb-2 text-gray-700 dark:text-gray-300">
                    {createClickablePageLinks(issue.description, onPageClick)}
                  </p>
                  {issue.location && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      📍 Location: {createClickablePageLinks(issue.location, onPageClick)}
                    </p>
                  )}
                  {issue.detectedValues && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">🔍 Detected: <span className="font-bold text-gray-900 dark:text-gray-100">{issue.detectedValues}</span></p>
                  )}
                  {issue.impact && (
                    <p className="text-sm mt-2 p-2 bg-white dark:bg-gray-800 rounded italic text-gray-700 dark:text-gray-300">
                      Impact: {createClickablePageLinks(issue.impact, onPageClick)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function ComplianceTab({ data, onPageClick, projectId }: { data: any; onPageClick: (page: number) => void; projectId?: number }) {
  const compliance = data?.mdonerComplianceScoring
  const [projectWeights, setProjectWeights] = useState<any>(null)
  const [weightsLoading, setWeightsLoading] = useState(true)

  // Fetch project-specific weights
  useEffect(() => {
    async function loadWeights() {
      if (!projectId) {
        setWeightsLoading(false)
        return
      }

      try {
        const response = await fetch(`http://127.0.0.1:8000/projects/${projectId}/compliance-weights`)
        if (response.ok) {
          const data = await response.json()
          setProjectWeights(data.weights)
        }
      } catch (err) {
        console.error('Failed to load project weights:', err)
      } finally {
        setWeightsLoading(false)
      }
    }
    loadWeights()
  }, [projectId])

  if (!compliance) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        <p className="text-muted-foreground">Compliance scoring data not available</p>
      </div>
    )
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Function to convert camelCase to readable label
  const formatLabel = (key: string) => {
    // Special cases for compound words
    const specialCases: Record<string, string> = {
      'schemeEligibilityAlignment': 'Scheme Eligibility Alignment',
      'technicalEngineeringQuality': 'Technical & Engineering Quality',
      'environmentalStatutoryCompliance': 'Environmental & Statutory Compliance',
      'landAcquisitionSocialSafeguards': 'Land Acquisition & Social Safeguards',
      'financialRealismCostIntegrity': 'Financial Realism & Cost Integrity',
      'implementationReadinessMonitoring': 'Implementation Readiness & Monitoring',
      'riskPreparednessHazardMitigation': 'Risk Preparedness & Hazard Mitigation',
      'innovationTechnologyAdoption': 'Innovation & Technology Adoption',
      'governanceTransparencyAccountability': 'Governance, Transparency & Accountability',
      'northEasternFocus': 'North Eastern Focus',
      'beneficiaryAlignment': 'Beneficiary Alignment',
      'documentationQuality': 'Documentation Quality',
      'environmentalCompliance': 'Environmental Compliance',
      'landAcquisition': 'Land Acquisition',
      'financialViability': 'Financial Viability',
    }

    if (specialCases[key]) return specialCases[key]

    // Fallback: convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  // Get weight percentage for display - dynamically from data
  const getWeightPercentage = (key: string) => {
    const item = compliance.scoringBreakdown?.[key]
    if (item && item.weight !== undefined) {
      return `${Math.round(item.weight * 100)}%`
    }
    if (projectWeights && projectWeights[key]) {
      return `${Math.round(projectWeights[key] * 100)}%`
    }
    return '0%'
  }

  // Dynamic criteria generation from actual data
  const criteria = compliance.scoringBreakdown
    ? Object.keys(compliance.scoringBreakdown).map(key => ({
      key,
      label: formatLabel(key)
    }))
    : []

  return (
    <div className="space-y-6">
      <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall MDoNER Compliance Score</h3>
        <div className={`text-5xl font-bold ${scoreColor(compliance.overallComplianceScore || 0)}`}>
          {compliance.overallComplianceScore || 0}/100
        </div>
      </div>

      {/* Weight Configuration Section */}
      {!weightsLoading && projectWeights && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Weight Configuration
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {criteria.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-semibold ml-2">{getWeightPercentage(key)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-semibold">Scoring Breakdown</h4>
        {criteria.map(({ key, label }) => {
          const item = compliance.scoringBreakdown?.[key]
          if (!item) return null

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${scoreColor(item.score || 0)}`}>
                    {item.score || 0}/100
                  </span>
                  {item.met ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${item.score || 0}%` }}
                />
              </div>
              {item.findings && (
                <p className="text-xs text-muted-foreground pl-4">
                  {createClickablePageLinks(item.findings, onPageClick)}
                </p>
              )}
              {item.detailedReasoning && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">Detailed Reasoning:</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {createClickablePageLinks(item.detailedReasoning, onPageClick)}
                  </p>
                </div>
              )}
              {item.evidence && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">Evidence:</p>
                  {item.evidence.quote && (
                    <blockquote className="text-xs italic text-gray-700 dark:text-gray-300 border-l-2 border-amber-400 pl-2 mb-2">
                      "{item.evidence.quote}"
                    </blockquote>
                  )}
                  {item.evidence.pageLocation && (
                    <p className="text-xs text-muted-foreground">
                      📍 Reference: {createClickablePageLinks(item.evidence.pageLocation, onPageClick)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {compliance.complianceGaps && compliance.complianceGaps.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-red-600">Compliance Gaps</h4>
          <ul className="space-y-2">
            {compliance.complianceGaps.map((gap: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {compliance.complianceStrengths && compliance.complianceStrengths.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-green-600">Compliance Strengths</h4>
          <ul className="space-y-2">
            {compliance.complianceStrengths.map((strength: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RecommendationsTab({ data, onPageClick }: { data: any; onPageClick: (page: number) => void }) {
  const recommendations = data?.smartRecommendations

  if (!recommendations) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        <p className="text-muted-foreground">Recommendations not available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {recommendations.criticalActions && recommendations.criticalActions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h4 className="font-semibold text-red-600">Critical Actions Required</h4>
          </div>
          <div className="space-y-2">
            {recommendations.criticalActions.map((action: string, idx: number) => (
              <Card key={idx} className="p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-950">
                <p className="text-sm text-gray-700 dark:text-gray-300">{action}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recommendations.improvementSuggestions && recommendations.improvementSuggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            <h4 className="font-semibold text-yellow-600">Improvement Suggestions</h4>
          </div>
          <div className="space-y-2">
            {recommendations.improvementSuggestions.map((suggestion: string, idx: number) => (
              <Card key={idx} className="p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <p className="text-sm text-gray-700 dark:text-gray-300">{suggestion}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recommendations.bestPractices && recommendations.bestPractices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-blue-500" />
            <h4 className="font-semibold text-blue-600">MDoNER Best Practices</h4>
          </div>
          <ul className="space-y-2">
            {recommendations.bestPractices.map((practice: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{practice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.nextSteps && recommendations.nextSteps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold text-green-600">Next Steps (Priority Order)</h4>
          </div>
          <div className="space-y-2">
            {recommendations.nextSteps.map((step: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <p className="text-sm flex-1 pt-0.5 text-gray-700 dark:text-gray-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
