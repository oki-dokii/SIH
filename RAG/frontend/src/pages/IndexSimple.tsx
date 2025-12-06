import { HeaderSimple } from '@/components/HeaderSimple'
import { UploadZone } from '@/components/UploadZone'
import { ChatInterface } from '@/components/ChatInterface'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sparkles, FileText, MessageSquare, Trash2, Upload } from 'lucide-react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api-simple'

interface Message {
    id: number
    pdf_id: number
    role: 'user' | 'assistant'
    text: string
    timestamp: string
}

interface PDF {
    id: number
    filename: string
    original_filename: string
    num_chunks: number | null
    upload_ts: string
}

export default function IndexPage() {
    const [currentPdf, setCurrentPdf] = useState<PDF | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [processing, setProcessing] = useState(false)
    const [chatLoading, setChatLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (currentPdf) {
            loadChatHistory()
        }
    }, [currentPdf])

    const loadChatHistory = async () => {
        if (!currentPdf) return

        try {
            const history = await api.getChatHistory(currentPdf.id)
            setMessages(history.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })))
        } catch (err) {
            console.error('Failed to load chat history:', err)
        }
    }

    const handleUpload = async (file: File) => {
        setUploading(true)
        setProcessing(false)
        setError(null)
        setUploadProgress(0)

        try {
            const result = await api.uploadPDF(file, (progress) => {
                setUploadProgress(progress)
                if (progress >= 99) {
                    setProcessing(true)
                }
            })

            const pdfDetails = await api.getPDF(result.id)
            setCurrentPdf(pdfDetails)
            setMessages([])
            setUploading(false)
            setProcessing(false)

        } catch (err) {
            setError('Failed to upload file. Please try again.')
            console.error('Upload error:', err)
            setUploading(false)
            setProcessing(false)
        }
    }

    const handleSendMessage = async (message: string) => {
        if (!currentPdf) return

        const userMessage: Message = {
            id: Date.now(),
            pdf_id: currentPdf.id,
            role: 'user',
            text: message,
            timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, userMessage])

        setChatLoading(true)
        try {
            const response = await api.sendChatMessage(currentPdf.id, message)

            const assistantMessage: Message = {
                id: Date.now() + 1,
                pdf_id: currentPdf.id,
                role: 'assistant',
                text: response.reply,
                timestamp: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, assistantMessage])

        } catch (err) {
            setError('Failed to send message. Please try again.')
            console.error('Chat error:', err)
            setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
        } finally {
            setChatLoading(false)
        }
    }

    const handleClearChat = async () => {
        if (!currentPdf) return
        if (!confirm('Are you sure you want to clear the chat history?')) return

        try {
            await api.clearChatHistory(currentPdf.id)
            setMessages([])
        } catch (err) {
            setError('Failed to clear chat. Please try again.')
            console.error('Clear chat error:', err)
        }
    }

    const handleNewUpload = () => {
        setCurrentPdf(null)
        setMessages([])
        setError(null)
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <HeaderSimple />

            <main className="flex-1 container mx-auto px-4 py-8">
                {!currentPdf ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12 animate-fade-in">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-4">
                                <Sparkles className="h-4 w-4" />
                                100% Offline PDF Chat
                            </div>

                            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                                Chat with Your{' '}
                                <span className="text-primary">PDFs</span>
                            </h1>

                            <p className="text-xl text-muted-foreground mb-8">
                                Upload any PDF and ask questions. Powered by your local RAG engine - completely offline.
                            </p>

                            {uploading ? (
                                <Card className="p-8 max-w-md mx-auto">
                                    <div className="text-center">
                                        <div className="mb-4">
                                            <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">
                                            {processing ? 'Processing PDF...' : 'Uploading...'}
                                        </h3>
                                        <p className="text-muted-foreground mb-4">
                                            {processing
                                                ? 'Analyzing content with AI. This may take a moment.'
                                                : 'Uploading your file...'}
                                        </p>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            {processing ? '100%' : `${Math.round(uploadProgress)}%`}
                                        </p>
                                    </div>
                                </Card>
                            ) : (
                                <div className="max-w-md mx-auto">
                                    <UploadZone onUpload={handleUpload} />
                                    {error && (
                                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                            <Card className="p-6 border-primary/20 hover:border-primary/40 transition-colors">
                                <FileText className="h-8 w-8 text-primary mb-3" />
                                <h3 className="font-semibold mb-2">Smart PDF Processing</h3>
                                <p className="text-sm text-muted-foreground">
                                    Advanced parsing with Docling for accurate text extraction
                                </p>
                            </Card>

                            <Card className="p-6 border-accent/20 hover:border-accent/40 transition-colors">
                                <MessageSquare className="h-8 w-8 text-accent mb-3" />
                                <h3 className="font-semibold mb-2">Intelligent Chat</h3>
                                <p className="text-sm text-muted-foreground">
                                    Powered by Ollama Llama 3.1 for accurate answers
                                </p>
                            </Card>

                            <Card className="p-6 border-primary/20 hover:border-primary/40 transition-colors">
                                <Sparkles className="h-8 w-8 text-primary mb-3" />
                                <h3 className="font-semibold mb-2">100% Offline</h3>
                                <p className="text-sm text-muted-foreground">
                                    No internet required. All processing happens locally
                                </p>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto h-[calc(100vh-200px)]">
                        <div className="flex flex-col h-full">
                            <Card className="p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold">{currentPdf.original_filename}</h2>
                                            <p className="text-sm text-muted-foreground">
                                                {currentPdf.num_chunks} chunks processed
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleClearChat}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Clear Chat
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleNewUpload}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            New Upload
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            <Card className="flex-1 flex flex-col overflow-hidden">
                                <ChatInterface
                                    messages={messages}
                                    onSendMessage={handleSendMessage}
                                    isLoading={chatLoading}
                                />
                            </Card>

                            {error && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className="border-t py-6 mt-8">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>© 2025 Offline PDF Chat - Powered by RAG Engine</p>
                </div>
            </footer>
        </div>
    )
}
