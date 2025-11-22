import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Send, Loader2, ArrowLeft, Calendar } from 'lucide-react'
import { api, Comparison, ComparisonMessage } from '../lib/api'
import { Header } from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export default function ComparisonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [messages, setMessages] = useState<ComparisonMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
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
            <Button onClick={() => navigate('/comparisons')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Comparisons
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/comparisons')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Comparisons
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{comparison.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents in Comparison</h3>
              <div className="space-y-3">
                {comparison.dprs?.map((dpr) => (
                  <div
                    key={dpr.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-cyan-500 transition-colors"
                    onClick={() => navigate(`/documents/${dpr.id}`)}
                  >
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {dpr.summary_json?.projectName || dpr.original_filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{dpr.original_filename}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <p className="text-sm text-gray-700">
                  <strong>💡 Tips for comparison:</strong>
                  <br />
                  Ask questions like "Which project has better ROI?" or "Compare the implementation timelines"
                </p>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="flex flex-col h-[calc(100vh-280px)]">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">AI Chat</h3>
                <p className="text-sm text-gray-600">Ask questions about these documents</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-cyan-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Start comparing documents</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Ask questions to compare these documents, find differences, or get insights across all of them.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                        <p
                          className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-cyan-100' : 'text-gray-500'
                          }`}
                        >
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question about these documents..."
                    disabled={sending}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100"
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
        </div>
      </div>
    </div>
  )
}
