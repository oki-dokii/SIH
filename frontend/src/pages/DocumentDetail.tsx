import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EnvironmentalImpact } from '@/components/EnvironmentalImpact'
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
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api, type DPR, type Message } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = [
  '#0ea5e9', // Sky blue
  '#10b981', // Emerald green
  '#f59e0b', // Amber orange
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
]

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
            <Button onClick={() => navigate('/documents')}>
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
          <Button variant="outline" onClick={() => navigate('/documents')}>
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
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {data.overallScore && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Overall Score
                </div>
                <div className="text-2xl font-bold text-primary">{data.overallScore}/100</div>
              </Card>
            )}
            {data.financialAnalysis?.projectCost?.totalInitialInvestmentLakhINR && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign className="h-4 w-4" />
                  Investment
                </div>
                <div className="text-xl font-bold">₹{data.financialAnalysis.projectCost.totalInitialInvestmentLakhINR}L</div>
              </Card>
            )}
            {data.timelineAnalysis?.implementationDurationMonths && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  Duration
                </div>
                <div className="text-xl font-bold">{data.timelineAnalysis.implementationDurationMonths} months</div>
              </Card>
            )}
            {data.projectLocation?.state && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <MapPin className="h-4 w-4" />
                  Location
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
                  Status
                </div>
                <div className="text-sm font-bold">{data.recommendation}</div>
              </Card>
            )}
            {data.projectSector && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Sector
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
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <div className="border-b p-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI Assistant</h3>
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
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg',
                      msg.role === 'user' 
                        ? 'bg-primary text-white ml-8' 
                        : 'bg-muted mr-8'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
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
                  placeholder="Ask about the document..."
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
    </div>
  )
}

function OverviewTab({ data }: { data: any }) {
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
            Location
          </h4>
          <p className="text-muted-foreground">
            {data.projectLocation.state}
            {data.projectLocation.districts && data.projectLocation.districts.length > 0 && (
              <> - {data.projectLocation.districts.join(', ')}</>
            )}
          </p>
        </div>
      )}

      {data.executiveSummary && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Executive Summary
          </h4>
          <p className="text-muted-foreground leading-relaxed">{data.executiveSummary}</p>
        </div>
      )}

      {data.scopeAndObjectives && (
        <div className="space-y-4">
          {data.scopeAndObjectives.vision && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Vision
              </h4>
              <p className="text-muted-foreground">{data.scopeAndObjectives.vision}</p>
            </div>
          )}

          {data.scopeAndObjectives.mission && (
            <div>
              <h4 className="font-semibold mb-2">Mission</h4>
              <p className="text-muted-foreground">{data.scopeAndObjectives.mission}</p>
            </div>
          )}

          {data.scopeAndObjectives.objectives && data.scopeAndObjectives.objectives.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Key Objectives</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {data.scopeAndObjectives.objectives.map((obj: string, idx: number) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.financialAnalysis?.returnsAndCoverage && (
        <div className="grid md:grid-cols-2 gap-4">
          {data.financialAnalysis.returnsAndCoverage.avgDSCR && (
            <Card className="p-4 bg-cyan-50">
              <div className="text-sm text-muted-foreground mb-1">Avg DSCR</div>
              <div className="text-3xl font-bold text-primary">{data.financialAnalysis.returnsAndCoverage.avgDSCR}</div>
            </Card>
          )}
          {data.financialAnalysis.returnsAndCoverage.IRRPercent && (
            <Card className="p-4 bg-cyan-50">
              <div className="text-sm text-muted-foreground mb-1">IRR</div>
              <div className="text-3xl font-bold text-primary">{data.financialAnalysis.returnsAndCoverage.IRRPercent}%</div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TimelineTab({ data }: { data: any }) {
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
        <Card className="p-6 bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex items-center gap-4">
            <Clock className="h-10 w-10 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Implementation Duration</div>
              <div className="text-3xl font-bold">{timeline.implementationDurationMonths} Months</div>
            </div>
          </div>
        </Card>
      )}

      {timeline.milestones && timeline.milestones.length > 0 && (
        <div>
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Project Milestones
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
              <div key={idx} className="flex gap-2 items-start p-3 bg-orange-50 rounded-lg">
                <XCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{risk}</p>
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

  const financial = data.financialAnalysis

  const capitalStructureData = financial.capitalStructure ? [
    { name: 'NCDC Loan', value: financial.capitalStructure.ncdcLoanLakhINR || 0 },
    { name: 'Subsidy', value: financial.capitalStructure.subsidyLakhINR || 0 },
    { name: 'Own Contribution', value: financial.capitalStructure.equityOrOwnContributionLakhINR || 0 },
  ].filter(item => item.value > 0) : []

  const projectCostData = financial.projectCost ? [
    { name: 'Capital Expenditure', value: financial.projectCost.capitalExpenditureLakhINR || 0 },
    { name: 'Working Capital', value: financial.projectCost.workingCapitalLakhINR || 0 },
    { name: 'Contingency', value: financial.projectCost.contingencyLakhINR || 0 },
  ].filter(item => item.value > 0) : []

  const costBreakdownData = financial.costs?.fixedCostBreakdown ? 
    Object.entries(financial.costs.fixedCostBreakdown).map(([key, value]) => ({
      name: key.replace(/([A-Z])/g, ' $1').trim(),
      value: value as number
    })) : []

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">Financial Analysis</h3>

      {financial.projectCost && (
        <div>
          <h4 className="font-semibold mb-3">Project Cost Summary</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Investment</div>
              <div className="text-2xl font-bold text-primary">
                ₹{financial.projectCost.totalInitialInvestmentLakhINR} Lakhs
              </div>
            </Card>
            {financial.projectCost.capitalExpenditureLakhINR && (
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Capital Expenditure</div>
                <div className="text-2xl font-bold">
                  ₹{financial.projectCost.capitalExpenditureLakhINR} Lakhs
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {capitalStructureData.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Capital Structure</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={capitalStructureData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {capitalStructureData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₹${value} Lakhs`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {projectCostData.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Project Cost Breakdown</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectCostData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value} Lakhs`} />
              <Bar dataKey="value">
                {projectCostData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {costBreakdownData.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Fixed Cost Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costBreakdownData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip formatter={(value) => `₹${value} Lakhs`} />
              <Bar dataKey="value">
                {costBreakdownData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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
                risk.severity === 'High' ? 'border-red-300 bg-red-50' :
                risk.severity === 'Medium' ? 'border-orange-300 bg-orange-50' :
                'border-green-300 bg-green-50'
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
                    <h5 className="font-semibold mb-1">{risk.riskCategory}</h5>
                    <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                    {risk.evidence && (
                      <p className="text-xs text-muted-foreground italic">Evidence: {risk.evidence}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.complianceCheck && (
        <div>
          <h4 className="font-semibold mb-3">Compliance Check</h4>
          <div className="space-y-3">
            {data.complianceCheck.statutoryAndPermits && data.complianceCheck.statutoryAndPermits.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2">Statutory & Permits</h5>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.complianceCheck.statutoryAndPermits.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.complianceCheck.EHS && data.complianceCheck.EHS.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2">Environment, Health & Safety</h5>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.complianceCheck.EHS.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {data.environmentalImpact && (
        <EnvironmentalImpact data={data.environmentalImpact} />
      )}
    </div>
  )
}
