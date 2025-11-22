import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  ArrowLeft,
  Share2,
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
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api, type DPR, type Message } from '@/lib/api'

export default function DocumentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('overview')
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [document, setDocument] = useState<DPR | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const loadDocument = async (dprId: number) => {
    try {
      setLoading(true)
      const dpr = await api.getDPR(dprId)
      setDocument(dpr)
    } catch (err) {
      setError('Failed to load document')
      console.error('Error loading document:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadChatHistory = async (dprId: number) => {
    try {
      const messages = await api.getChatHistory(dprId)
      setChatHistory(messages)
    } catch (err) {
      console.error('Error loading chat history:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !id) return
    
    const userMessage = chatMessage
    setChatMessage('')
    
    const tempUserMessage: Message = {
      id: Date.now(),
      dpr_id: parseInt(id),
      role: 'user',
      text: userMessage,
      timestamp: new Date().toISOString(),
    }
    setChatHistory([...chatHistory, tempUserMessage])

    try {
      setChatLoading(true)
      const response = await api.sendChatMessage(parseInt(id), userMessage)
      setChatHistory((prev) => [...prev, response])
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message. Please try again.')
    } finally {
      setChatLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'timeline', label: 'Timeline' },
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

  const parsedData = document.summary_json

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
          <Button variant="outline">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {parsedData && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {parsedData.financial_analysis?.total_project_cost && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign className="h-4 w-4" />
                  Project Cost
                </div>
                <div className="text-xl font-bold">{parsedData.financial_analysis.total_project_cost}</div>
              </Card>
            )}
            {parsedData.timeline_analysis?.project_duration && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  Duration
                </div>
                <div className="text-xl font-bold">{parsedData.timeline_analysis.project_duration}</div>
              </Card>
            )}
            {parsedData.project_location && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <MapPin className="h-4 w-4" />
                  Location
                </div>
                <div className="text-xl font-bold">{parsedData.project_location}</div>
              </Card>
            )}
            {parsedData.timeline_analysis?.start_date && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  Start Date
                </div>
                <div className="text-xl font-bold">{parsedData.timeline_analysis.start_date}</div>
              </Card>
            )}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Status
              </div>
              <div className="text-xl font-bold">Analyzed</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Progress
              </div>
              <div className="text-xl font-bold">100%</div>
            </Card>
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
                  <div className="space-y-6">
                    {parsedData ? (
                      <>
                        {parsedData.project_overview && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              Project Overview
                            </h3>
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {parsedData.project_overview}
                            </p>
                          </div>
                        )}

                        {parsedData.objectives && parsedData.objectives.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Key Objectives</h4>
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                              {parsedData.objectives.map((obj: string, idx: number) => (
                                <li key={idx}>{obj}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {parsedData.financial_analysis && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">Financial Analysis</h3>
                            <div className="space-y-2">
                              {parsedData.financial_analysis.cost_breakdown && (
                                <div>
                                  <h4 className="font-medium mb-2">Cost Breakdown</h4>
                                  <pre className="text-sm text-muted-foreground bg-gray-50 p-4 rounded">
                                    {JSON.stringify(parsedData.financial_analysis.cost_breakdown, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Document is still being processed. Analysis will appear here once complete.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'analysis' && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Detailed analysis view coming soon. Use the AI Assistant to ask questions about the document.
                    </p>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Timeline view coming soon. Use the AI Assistant to ask about project timelines.
                    </p>
                  </div>
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
                    <p className="text-sm">{msg.text}</p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="p-3 rounded-lg bg-muted mr-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about the document..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button onClick={handleSendMessage} disabled={chatLoading || !chatMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
