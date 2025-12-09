import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft,
    FileText,
    Shield,
    AlertCircle,
    CheckCircle,
    XCircle,
    Target,
    Download,
    Loader2,
    MessageSquare,
    Send,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { ChatMessageFormatter } from '@/components/ChatMessageFormatter'
import { ChunkText } from '@/components/ChunkText'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Setup PDF.js worker - use jsDelivr which is more reliable than unpkg
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type AnalysisData = {
    projectName: string
    projectLocation: {
        state: string
        districts?: string
    }
    projectSector: string
    schemeName: string
    totalInvestment: string
    implementationDuration: string
    executiveSummary: string
    scopeAndObjectives: {
        objectives: string[]
        scope: string[]
        stakeholders: string[]
    }
    riskAssessment: Array<{
        name: string
        severity: string
        mitigation: string
        evidence: string
    }>
    inconsistencyDetection: {
        hasInconsistencies: boolean
        totalInconsistencies: number
        issues: Array<{
            category: string
            severity: string
            description: string
            location?: string
            impact?: string
        }>
    }
    mdonerComplianceScoring: {
        scores: Record<string, number>
        overallComplianceScore: number
        complianceGaps: string[]
        complianceStrengths: string[]
    }
    analysisMetadata?: {
        sectionalAnalysis: boolean
        sectionsAnalyzed: string[]
        timestamp: string
    }
}

type Message = {
    role: 'user' | 'assistant'
    content: string
}

export default function PDFAnalysis() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const [activeTab, setActiveTab] = useState('overview')
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // PDF viewer state
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [pdfScale, setPdfScale] = useState<number>(1.0)
    const pdfContainerRef = useRef<HTMLDivElement>(null)

    // PDF navigation function - now actually works!
    const handlePageNavigate = (pageNumber: number) => {
        console.log('Navigate to page:', pageNumber)
        if (pageNumber > 0 && pageNumber <= numPages) {
            setCurrentPage(pageNumber)
            // Scroll PDF viewer into view
            setTimeout(() => {
                pdfContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
        }
    }

    // Chat state
    const [chatMessage, setChatMessage] = useState('')
    const [chatHistory, setChatHistory] = useState<Message[]>([])
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (id) {
            loadAnalysis(parseInt(id))
            loadChatHistory(parseInt(id))
            loadPdfUrl(parseInt(id))
        }
    }, [id])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatHistory])

    async function loadAnalysis(pdfId: number) {
        try {
            setLoading(true)
            const response = await fetch(`/api/pdf/${pdfId}/analysis`)

            if (!response.ok) {
                throw new Error('Analysis not found')
            }

            const data = await response.json()
            setAnalysis(data)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analysis')
        } finally {
            setLoading(false)
        }
    }

    async function loadChatHistory(pdfId: number) {
        try {
            const response = await fetch(`/api/pdf/${pdfId}/messages`)
            if (response.ok) {
                const data = await response.json()
                // Backend returns { messages: [...], count: n }
                const messagesList = data.messages || []
                setChatHistory(messagesList.map((msg: any) => ({
                    role: msg.role,
                    content: msg.text  // Database field is 'text', map to 'content'
                })))
            }
        } catch (err) {
            console.error('Failed to load chat history:', err)
        }
    }

    async function loadPdfUrl(pdfId: number) {
        try {
            const response = await fetch(`/api/pdf/${pdfId}`)
            if (response.ok) {
                const data = await response.json()
                if (data.filepath) {
                    // Use relative URL that will work with Vite proxy
                    setPdfUrl(`/api/pdf/${pdfId}/file`)
                    console.log('PDF URL set:', `/api/pdf/${pdfId}/file`)
                }
            }
        } catch (err) {
            console.error('Failed to load PDF URL:', err)
        }
    }

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault()
        if (!chatMessage.trim() || !id || chatLoading) return

        const userMessage = chatMessage.trim()
        setChatMessage('')
        setChatLoading(true)

        // Add user message
        const userMsg: Message = { role: 'user', content: userMessage }
        setChatHistory(prev => [...prev, userMsg])

        try {
            const response = await fetch(`/api/pdf/${id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            })

            if (response.ok) {
                const data = await response.json()
                const assistantMsg: Message = { role: 'assistant', content: data.reply }
                setChatHistory(prev => [...prev, assistantMsg])
            }
        } catch (err) {
            console.error('Failed to send message:', err)
        } finally {
            setChatLoading(false)
        }
    }

    async function handleClearChat() {
        if (!id || !window.confirm('Clear chat history?')) return

        try {
            await fetch(`/api/pdf/${id}/messages`, { method: 'DELETE' })
            setChatHistory([])
        } catch (err) {
            console.error('Failed to clear chat:', err)
        }
    }

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'risks', label: 'Risk Assessment' },
        { id: 'inconsistencies', label: 'Inconsistencies' },
        { id: 'compliance', label: 'Compliance' },
    ]

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading analysis...</p>
                </div>
            </div>
        )
    }

    if (error || !analysis) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Analysis Not Found</h2>
                    <p className="text-gray-600 mb-6">
                        {error || 'The analysis for this PDF could not be loaded.'}
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <ArrowLeft className="inline h-4 w-4 mr-2" />
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{analysis.projectName}</h1>
                            <p className="text-sm text-gray-600">
                                {analysis.projectLocation.state} • {analysis.projectSector}
                            </p>
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards + Main Content Grid */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    {/* Overall Score */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Overall Score
                        </div>
                        <div className={`text-3xl font-bold ${analysis.mdonerComplianceScoring.overallComplianceScore >= 80
                            ? 'text-green-600'
                            : analysis.mdonerComplianceScoring.overallComplianceScore >= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                            {Math.round(analysis.mdonerComplianceScoring.overallComplianceScore)}/100
                        </div>
                    </div>

                    {/* Total Investment */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Total Investment
                        </div>
                        <div className="text-xl font-semibold text-gray-900">
                            {analysis.totalInvestment || 'N/A'}
                        </div>
                    </div>

                    {/* Implementation Duration */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Implementation Duration
                        </div>
                        <div className="text-xl font-semibold text-gray-900">
                            {analysis.implementationDuration || 'N/A'}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Location
                        </div>
                        <div className="text-xl font-semibold text-gray-900">
                            {analysis.projectLocation.state}
                        </div>
                    </div>

                    {/* Sector */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Sector
                        </div>
                        <div className="text-xl font-semibold text-gray-900">
                            {analysis.projectSector}
                        </div>
                    </div>
                </div>

                {/* Main Grid: Analysis (left) | PDF+Chat (right) */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Analysis Tabs - 1/3 width (left) */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow">
                            <div className="border-b">
                                <div className="flex overflow-x-auto">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-6 py-3 font-medium transition whitespace-nowrap ${activeTab === tab.id
                                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6">
                                {activeTab === 'overview' && <OverviewTab data={analysis} />}
                                {activeTab === 'risks' && <RisksTab data={analysis} pdfId={parseInt(id!)} onPageNavigate={handlePageNavigate} />}
                                {activeTab === 'inconsistencies' && <InconsistenciesTab data={analysis} pdfId={parseInt(id!)} onPageNavigate={handlePageNavigate} />}
                                {activeTab === 'compliance' && <ComplianceTab data={analysis} />}
                            </div>
                        </div>
                    </div>

                    {/* PDF Viewer + Chat Stack - 2/3 width (right) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* PDF Viewer */}
                        <div className="bg-white rounded-lg shadow" ref={pdfContainerRef}>
                            <div className="border-b p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    <h3 className="font-semibold">PDF Viewer</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPdfScale(s => Math.max(0.5, s - 0.1))}
                                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                                        title="Zoom out"
                                    >
                                        -
                                    </button>
                                    <span className="text-sm text-gray-600">{Math.round(pdfScale * 100)}%</span>
                                    <button
                                        onClick={() => setPdfScale(s => Math.min(2.0, s + 0.1))}
                                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                                        title="Zoom in"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="h-[600px] overflow-auto bg-gray-100 flex flex-col items-center p-4">
                                {pdfUrl ? (
                                    <>
                                        <div className="text-xs text-gray-500 mb-2">PDF URL: {pdfUrl}</div>
                                        <Document
                                            file={pdfUrl}
                                            onLoadSuccess={({ numPages }) => {
                                                console.log('PDF loaded successfully, pages:', numPages)
                                                setNumPages(numPages)
                                            }}
                                            onLoadError={(error) => {
                                                console.error('PDF load error:', error)
                                                alert(`PDF Error: ${error.message}`)
                                            }}
                                            loading={
                                                <div className="flex items-center justify-center h-full">
                                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                                </div>
                                            }
                                            error={
                                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                    <XCircle className="h-12 w-12 mb-2" />
                                                    <p>Failed to load PDF</p>
                                                    <p className="text-xs mt-2">URL: {pdfUrl}</p>
                                                </div>
                                            }
                                        >
                                            <Page
                                                pageNumber={currentPage}
                                                scale={pdfScale}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={true}
                                            />
                                        </Document>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <p>Loading PDF...</p>
                                    </div>
                                )}
                            </div>

                            {numPages > 0 && (
                                <div className="border-t p-3 flex items-center justify-between">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage <= 1}
                                        className="px-3 py-1.5 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Page {currentPage} of {numPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                                        disabled={currentPage >= numPages}
                                        className="px-3 py-1.5 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Chat Sidebar */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="border-b p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-blue-600" />
                                    <h3 className="font-semibold">Chat</h3>
                                </div>
                                {chatHistory.length > 0 && (
                                    <button
                                        onClick={handleClearChat}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 hover:text-red-600"
                                        title="Clear chat"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                                {chatHistory.length === 0 && (
                                    <div className="p-3 rounded-lg bg-blue-50 text-sm text-gray-700">
                                        👋 Hello! Ask me anything about this PDF analysis.
                                    </div>
                                )}
                                {chatHistory.map((msg, index) => (
                                    msg.role === 'assistant' ? (
                                        <div key={index} className="w-full flex justify-start">
                                            <ChatMessageFormatter text={msg.content} isUser={false} />
                                        </div>
                                    ) : (
                                        <div key={index} className="w-full flex justify-end">
                                            <div className="p-3 rounded-lg bg-blue-100 max-w-[80%]">
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    )
                                ))}
                                {chatLoading && (
                                    <div className="p-3 rounded-lg bg-gray-100 mr-8 flex items-center gap-2">
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
                                    placeholder="Ask a question..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={chatLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={chatLoading || !chatMessage.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function OverviewTab({ data }: { data: AnalysisData }) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Executive Summary
                </h3>
                <p className="text-gray-700 leading-relaxed">{data.executiveSummary}</p>
            </div>

            {data.scopeAndObjectives.objectives.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-600" />
                        Project Objectives
                    </h4>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                        {data.scopeAndObjectives.objectives.map((obj, idx) => (
                            <li key={idx}>{obj}</li>
                        ))}
                    </ul>
                </div>
            )}

            {data.scopeAndObjectives.scope.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-2">Scope</h4>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                        {data.scopeAndObjectives.scope.map((scope, idx) => (
                            <li key={idx}>{scope}</li>
                        ))}
                    </ul>
                </div>
            )}

            {data.scopeAndObjectives.stakeholders.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-2">Key Stakeholders</h4>
                    <div className="flex flex-wrap gap-2">
                        {data.scopeAndObjectives.stakeholders.map((stakeholder, idx) => (
                            <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                            >
                                {stakeholder}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function RisksTab({ data, pdfId, onPageNavigate }: { data: AnalysisData; pdfId: number; onPageNavigate: (page: number) => void }) {
    const severityColors = {
        HIGH: 'bg-red-50 border-red-300',
        MEDIUM: 'bg-orange-50 border-orange-300',
        LOW: 'bg-green-50 border-green-300',
    }

    const severityBadges = {
        HIGH: 'bg-red-200 text-red-800',
        MEDIUM: 'bg-orange-200 text-orange-800',
        LOW: 'bg-green-200 text-green-800',
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Risk Assessment ({data.riskAssessment.length} identified)
            </h3>

            {data.riskAssessment.map((risk, idx) => (
                <div
                    key={idx}
                    className={`p-4 border-2 rounded-lg ${severityColors[risk.severity as keyof typeof severityColors] || 'bg-gray-50'
                        }`}
                >
                    <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{risk.name}</h4>
                        <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${severityBadges[risk.severity as keyof typeof severityBadges]
                                }`}
                        >
                            {risk.severity}
                        </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                        <strong>Mitigation:</strong> <ChunkText
                            text={risk.mitigation}
                            pdfId={pdfId}
                            onPageNavigate={onPageNavigate}
                        />
                    </p>
                    <p className="text-xs text-gray-600 italic">
                        <ChunkText
                            text={risk.evidence}
                            pdfId={pdfId}
                            onPageNavigate={onPageNavigate}
                        />
                    </p>
                </div>
            ))}
        </div>
    )
}

function InconsistenciesTab({ data, pdfId, onPageNavigate }: { data: AnalysisData; pdfId: number; onPageNavigate: (page: number) => void }) {
    const inconsistencies = data.inconsistencyDetection

    if (!inconsistencies.hasInconsistencies) {
        return (
            <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">No Inconsistencies Detected</h3>
                <p className="text-gray-600">The PDF appears to be internally consistent</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                    Inconsistencies Detected ({inconsistencies.totalInconsistencies})
                </h3>
                <XCircle className="h-8 w-8 text-red-500" />
            </div>

            {inconsistencies.issues.map((issue, idx) => (
                <div
                    key={idx}
                    className="p-4 border-2 border-red-200 bg-red-50 rounded-lg"
                >
                    <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{issue.category}</h4>
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-200 text-red-800">
                            {issue.severity}
                        </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                        <ChunkText
                            text={issue.description}
                            pdfId={pdfId}
                            onPageNavigate={onPageNavigate}
                        />
                    </p>
                    {issue.location && (
                        <p className="text-xs text-gray-600 mb-1">
                            📍 Location: <ChunkText
                                text={issue.location}
                                pdfId={pdfId}
                                onPageNavigate={onPageNavigate}
                            />
                        </p>
                    )}
                    {issue.impact && (
                        <p className="text-xs mt-2 p-2 bg-white rounded italic">Impact: {issue.impact}</p>
                    )}
                </div>
            ))}
        </div>
    )
}

function ComplianceTab({ data }: { data: AnalysisData }) {
    const compliance = data.mdonerComplianceScoring

    // Safety check
    if (!compliance) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Compliance data not available</p>
            </div>
        )
    }

    const scoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600'
        if (score >= 60) return 'text-yellow-600'
        return 'text-red-600'
    }

    // Get all score entries - with safety check
    const scoreEntries = compliance.scores ? Object.entries(compliance.scores) : []

    return (
        <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                    Overall MDoNER Compliance Score
                </h3>
                <div className={`text-6xl font-bold ${scoreColor(compliance.overallComplianceScore || 0)}`}>
                    {Math.round(compliance.overallComplianceScore || 0)}/100
                </div>
            </div>

            {/* Score Breakdown */}
            {scoreEntries.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-3">Scoring Breakdown</h4>
                    <div className="space-y-3">
                        {scoreEntries.map(([key, score]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium capitalize">
                                        {key}
                                    </span>
                                    <span className={`text-sm font-semibold ${scoreColor(score)}`}>
                                        {score}/100
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Gaps */}
            {compliance.complianceGaps && compliance.complianceGaps.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-3 text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Compliance Gaps ({compliance.complianceGaps.length})
                    </h4>
                    <ul className="space-y-2">
                        {compliance.complianceGaps.map((gap, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{gap}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Strengths */}
            {compliance.complianceStrengths && compliance.complianceStrengths.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-3 text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Compliance Strengths ({compliance.complianceStrengths.length})
                    </h4>
                    <ul className="space-y-2">
                        {compliance.complianceStrengths.map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{strength}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
