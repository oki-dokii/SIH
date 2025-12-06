import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChatMessageFormatter } from '@/components/ChatMessageFormatter'
import {
  ArrowLeft,
  MessageSquare,
  Send,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type DPR, type Message } from '@/lib/api'

export default function DocumentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [document, setDocument] = useState<DPR | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      // Remove failed user message
      setChatHistory(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setChatLoading(false)
    }
  }

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
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{document.original_filename}</h1>
            <p className="text-muted-foreground">
              Uploaded on {new Date(document.upload_ts).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* PDF Info Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Document Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Filename:</span>
                  <p className="font-medium">{document.filename}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Chunks Processed:</span>
                  <p className="font-medium">{document.num_chunks || 'Processing...'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Upload Time:</span>
                  <p className="font-medium">{new Date(document.upload_ts).toLocaleTimeString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium text-green-600">Ready for Chat</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Chat Section - Full Width */}
        <Card className="h-[600px] flex flex-col">
          <div className="border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Chat with your PDF</h3>
            </div>
            {chatHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </Button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHistory.length === 0 && (
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">
                  👋 Hello! I'm your PDF assistant. Ask me anything about this document!
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try asking: "What is this document about?" or "Summarize the key points"
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
              placeholder="Ask a question about your PDF..."
              className="flex-1 px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={chatLoading}
            />
            <Button type="submit" disabled={chatLoading || !chatMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </main>

      {/* Clear Chat Confirmation Modal */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-2">Clear Chat History?</h3>
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
