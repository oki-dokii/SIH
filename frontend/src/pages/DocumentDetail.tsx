import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EnvironmentalImpact } from '@/components/EnvironmentalImpact'
import { FinancialCharts } from '@/components/FinancialCharts'
import { ChatMessageFormatter } from '@/components/ChatMessageFormatter'
import { LocationMap } from '@/components/LocationMap'
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
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api, type DPR, type Message } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function DocumentDetailPage() {
  const navigate = useNavigate()
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
  const chatEndRef = useRef<HTMLDivElement>(null)

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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
                <div className="text-xl font-bold">₹{data.financialAnalysis.projectCost.totalInitialInvestmentLakhINR}L</div>
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

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <div className="border-b">
                <div className="flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-6 py-3 font-medium transition-colors',
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

              <div className="p-6">
                {activeTab === 'overview' && (
                  <OverviewTab data={data} />
                )}

                {activeTab === 'analysis' && (
                  <AnalysisTab data={data} />
                )}

                {activeTab === 'timeline' && (
                  <TimelineTab data={data} />
                )}

                {activeTab === 'riskAssessment' && (
                  <RiskAssessmentTab data={data} />
                )}

                {activeTab === 'inconsistencies' && (
                  <InconsistenciesTab data={data} />
                )}

                {activeTab === 'compliance' && (
                  <ComplianceTab data={data} />
                )}

                {activeTab === 'recommendations' && (
                  <RecommendationsTab data={data} />
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
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
          </div>
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

function OverviewTab({ data }: { data: any }) {
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
          <p className="text-muted-foreground leading-relaxed">{data.executiveSummary}</p>
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

function TimelineTab({ data }: { data: any }) {
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

function AnalysisTab({ data }: { data: any }) {
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

function RiskAssessmentTab({ data }: { data: any }) {
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
                    'px-2 py-1 rounded text-xs font-semibold',
                    risk.severity === 'High' ? 'bg-red-200 text-red-800' :
                      risk.severity === 'Medium' ? 'bg-orange-200 text-orange-800' :
                        'bg-green-200 text-green-800'
                  )}>
                    {risk.severity}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold mb-1 dark:text-gray-100">{risk.riskCategory}</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{risk.description}</p>
                    {risk.evidence && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">Evidence: {risk.evidence}</p>
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

function InconsistenciesTab({ data }: { data: any }) {
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
                    <h4 className="font-semibold dark:text-gray-100">{issue.category}</h4>
                    <span className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 dark:text-gray-200">{issue.severity}</span>
                  </div>
                  <p className="text-sm mb-2 text-gray-700 dark:text-gray-300">{issue.description}</p>
                  {issue.location && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">📍 Location: {issue.location}</p>
                  )}
                  {issue.detectedValues && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">🔍 Detected: {issue.detectedValues}</p>
                  )}
                  {issue.impact && (
                    <p className="text-xs mt-2 p-2 bg-white dark:bg-gray-800 rounded italic text-gray-700 dark:text-gray-300">Impact: {issue.impact}</p>
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

function ComplianceTab({ data }: { data: any }) {
  const compliance = data?.mdonerComplianceScoring

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

  const criteria = [
    { key: 'northEasternFocus', label: 'North Eastern Focus', weight: '25%' },
    { key: 'beneficiaryAlignment', label: 'Beneficiary Alignment', weight: '20%' },
    { key: 'environmentalCompliance', label: 'Environmental Compliance', weight: '20%' },
    { key: 'landAcquisition', label: 'Land Acquisition', weight: '15%' },
    { key: 'documentationQuality', label: 'Documentation Quality', weight: '10%' },
    { key: 'financialViability', label: 'Financial Viability', weight: '10%' },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall MDoNER Compliance Score</h3>
        <div className={`text-5xl font-bold ${scoreColor(compliance.overallComplianceScore || 0)}`}>
          {compliance.overallComplianceScore || 0}/100
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Scoring Breakdown</h4>
        {criteria.map(({ key, label, weight }) => {
          const item = compliance.scoringBreakdown?.[key]
          if (!item) return null

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label} ({weight})</span>
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
                <p className="text-xs text-muted-foreground pl-4">{item.findings}</p>
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

function RecommendationsTab({ data }: { data: any }) {
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
