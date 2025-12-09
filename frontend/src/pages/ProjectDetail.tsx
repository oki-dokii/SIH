import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
    Search,
    FileText,
    Eye,
    Calendar,
    Loader2,
    ArrowLeft,
    MapPin,
    Layers,
    Briefcase,
    X,
    Scale,
    Trophy,
    CheckCircle,
    AlertCircle,
    Download,
    ExternalLink,
    Settings,
    MessageSquare,
    Check,
    XCircle
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type DPR, type Project } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import ComplianceWeightsModal from '@/components/ComplianceWeightsModal'
import FeedbackModal from '@/components/FeedbackModal'

export default function ProjectDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const { t } = useLanguage()
    const [project, setProject] = useState<Project | null>(null)
    const [documents, setDocuments] = useState<DPR[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Analyzing state
    const [analyzingDpr, setAnalyzingDpr] = useState<number | null>(null)

    // Compare All state
    const [comparing, setComparing] = useState(false)
    const [showComparisonModal, setShowComparisonModal] = useState(false)
    const [comparisonResult, setComparisonResult] = useState<any>(null)
    const [comparisonError, setComparisonError] = useState<string | null>(null)

    // Compliance Weights Modal state
    const [showComplianceWeights, setShowComplianceWeights] = useState(false)

    // Feedback Modal state
    const [feedbackDpr, setFeedbackDpr] = useState<DPR | null>(null)

    useEffect(() => {
        if (id) {
            loadProjectData(parseInt(id))
        }
    }, [id])

    const loadProjectData = async (projectId: number) => {
        try {
            setLoading(true)
            const [projData, dprsData] = await Promise.all([
                api.getProject(projectId),
                api.getProjectDPRs(projectId)
            ])
            setProject(projData)
            setDocuments(dprsData)
        } catch (err) {
            setError(t('projectDetail.failedToLoadProject'))
            console.error('Error loading project data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAnalyze = async (dprId: number) => {
        setAnalyzingDpr(dprId)
        try {
            console.log(`Starting analysis for DPR ${dprId}...`)
            const response = await fetch(`http://127.0.0.1:8000/dprs/${dprId}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            console.log('Response status:', response.status)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
                console.error('Analysis error response:', errorData)
                throw new Error(errorData.detail || `Analysis failed with status ${response.status}`)
            }

            const result = await response.json()
            console.log('Analysis result:', result)

            // Reload to get updated DPR with analysis
            if (id) {
                await loadProjectData(parseInt(id))
            }

            alert('DPR analyzed successfully!')
        } catch (err: any) {
            console.error('Analysis error:', err)
            alert(`Failed to analyze DPR: ${err.message}. Check console for details.`)
        } finally {
            setAnalyzingDpr(null)
        }
    }

    const handleCompareAll = async () => {
        if (!id) return

        setComparing(true)
        setComparisonError(null)
        setComparisonResult(null)

        try {
            const result = await api.compareAllProjectDPRs(parseInt(id))
            setComparisonResult(result.comparison)
            setShowComparisonModal(true)

            // Reload project data to update has_comparison flag
            await loadProjectData(parseInt(id))
        } catch (err: any) {
            setComparisonError(err.message || 'Failed to compare DPRs')
            setShowComparisonModal(true)
        } finally {
            setComparing(false)
        }
    }

    // Count analyzed DPRs
    const analyzedDprsCount = documents.filter(doc => doc.summary_json).length



    const getDocumentStatus = (doc: DPR) => {
        // Check status field first (if it exists)
        if ((doc as any).status === 'analyzing') {
            return { label: 'Analyzing...', color: 'text-blue-600', bg: 'bg-blue-50' }
        }
        if ((doc as any).status === 'pending') {
            return { label: 'Pending Analysis', color: 'text-yellow-600', bg: 'bg-yellow-50' }
        }
        if (doc.summary_json || (doc as any).status === 'completed') {
            return { label: t('projectDetail.completed'), color: 'text-green-600', bg: 'bg-green-50' }
        }
        // Fallback for old data
        return { label: 'Pending Analysis', color: 'text-yellow-600', bg: 'bg-yellow-50' }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString()
    }

    const filteredDocuments = documents.filter(doc =>
        doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    )

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

    if (error || !project) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <Card className="p-12 text-center">
                        <h2 className="text-2xl font-bold mb-2">{t('projectDetail.projectNotFound')}</h2>
                        <p className="text-muted-foreground mb-6">
                            {error || t('projectDetail.projectNotFoundDesc')}
                        </p>
                        <Button onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Projects
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
                <div className="mb-8">
                    <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Projects
                    </Button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {project.state}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Layers className="h-4 w-4" />
                                    {project.scheme}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Briefcase className="h-4 w-4" />
                                    {project.sector}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {t('projectDetail.created')}: {formatDate(project.created_at)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {/* Compliance Weights Settings Button */}
                            <Button
                                variant="outline"
                                onClick={() => setShowComplianceWeights(true)}
                                title="Configure Compliance Weights"
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Compliance Weights
                            </Button>

                            {/* Compare All Button */}
                            {analyzedDprsCount >= 2 && (
                                <Button
                                    onClick={async () => {
                                        // If comparison already exists, fetch and show it
                                        if ((project as any).has_comparison) {
                                            try {
                                                const response = await fetch(`http://127.0.0.1:8000/projects/${id}/comparison`)
                                                if (response.ok) {
                                                    const data = await response.json()
                                                    setComparisonResult(data.comparison)
                                                    setShowComparisonModal(true)
                                                } else {
                                                    // If fetch fails, generate new comparison
                                                    handleCompareAll()
                                                }
                                            } catch (err) {
                                                console.error('Error fetching comparison:', err)
                                                handleCompareAll()
                                            }
                                        } else {
                                            // Generate new comparison
                                            handleCompareAll()
                                        }
                                    }}
                                    disabled={comparing}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                                >
                                    {comparing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Comparing...
                                        </>
                                    ) : (project as any).has_comparison ? (
                                        <>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Comparison
                                        </>
                                    ) : (
                                        <>
                                            <Scale className="h-4 w-4 mr-2" />
                                            Compare All DPRs
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('projectDetail.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {filteredDocuments.length === 0 && (
                    <Card className="p-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{t('projectDetail.noDocuments')}</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery ? t('projectDetail.differentSearchTerm') : 'Clients upload DPRs for this project. Once uploaded, they will appear here for analysis.'}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            You can view and analyze submitted DPRs once they are uploaded.
                        </p>
                    </Card>
                )}

                <div className="flex flex-col gap-4">
                    {filteredDocuments.map((doc) => {
                        const status = getDocumentStatus(doc)
                        const hasFlags = doc.validation_flags?.hasFlags || false
                        const overallScore = doc.summary_json?.overallScore

                        // Determine score color based on value (force red if flagged)
                        const getScoreColor = () => {
                            if (hasFlags) {
                                return {
                                    bg: 'bg-red-100 dark:bg-red-900/50',
                                    text: 'text-red-700 dark:text-red-400',
                                    border: 'border-red-300 dark:border-red-700'
                                }
                            }
                            if (!overallScore) return null
                            if (overallScore >= 75) {
                                return {
                                    bg: 'bg-green-100 dark:bg-green-900/50',
                                    text: 'text-green-700 dark:text-green-400',
                                    border: 'border-green-300 dark:border-green-700'
                                }
                            }
                            if (overallScore >= 50) {
                                return {
                                    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
                                    text: 'text-yellow-700 dark:text-yellow-400',
                                    border: 'border-yellow-300 dark:border-yellow-700'
                                }
                            }
                            return {
                                bg: 'bg-red-100 dark:bg-red-900/50',
                                text: 'text-red-700 dark:text-red-400',
                                border: 'border-red-300 dark:border-red-700'
                            }
                        }

                        const scoreColor = getScoreColor()

                        return (
                            <Card
                                key={doc.id}
                                className={`p-4 transition-all flex flex-col md:flex-row items-start md:items-center gap-4 ${hasFlags
                                    ? 'border-red-500 dark:border-red-600 border-2 bg-red-50 dark:bg-red-950/20'
                                    : 'hover:border-primary/40'
                                    }`}
                            >
                                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>

                                <div className="flex-1 min-w-0 w-full">
                                    <h3 className="font-semibold truncate" title={doc.original_filename}>{doc.original_filename}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full ${status.bg} ${status.color} font-medium`}>
                                            {status.label}
                                        </span>
                                        {hasFlags && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 font-medium">
                                                <AlertCircle className="h-3 w-3" />
                                                Flagged ({doc.validation_flags?.flags.length || 0})
                                            </span>
                                        )}
                                        {scoreColor && overallScore !== undefined && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${scoreColor.bg} ${scoreColor.text} border ${scoreColor.border} font-medium`}>
                                                <Scale className="h-3 w-3" />
                                                Score: {overallScore}/100
                                            </span>
                                        )}
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(doc.upload_ts)}
                                        </span>
                                        {doc.client_email && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1" title={`Submitted by: ${doc.client_email}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect width="20" height="16" x="2" y="4" rx="2" />
                                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                                    </svg>
                                                    <span className="truncate max-w-[150px]">{doc.client_email}</span>
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Validation Flags Details */}
                                    {hasFlags && doc.validation_flags && doc.validation_flags.flags.length > 0 && (
                                        <div className="mt-2 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                                            <div className="space-y-1">
                                                {doc.validation_flags.flags.map((flag, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                                                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                        <span>{flag.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                    {/* View PDF Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => window.open(`/api/dpr/${doc.id}/pdf`, '_blank')}
                                        title="View PDF in new tab"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>

                                    {/* Download PDF Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `/api/dpr/${doc.id}/pdf`;
                                            link.download = doc.original_filename;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }}
                                        title="Download PDF"
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>

                                    {!doc.summary_json ? (
                                        <Button
                                            size="sm"
                                            className="flex-1 md:flex-none"
                                            onClick={() => handleAnalyze(doc.id)}
                                            disabled={analyzingDpr === doc.id || (doc as any).status === 'analyzing'}
                                        >
                                            {(analyzingDpr === doc.id || (doc as any).status === 'analyzing') ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Analyzing...
                                                </>
                                            ) : (
                                                <>
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Analyze DPR
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            className="flex-1 md:flex-none"
                                            onClick={() => navigate(`/admin/documents/${doc.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Analysis
                                        </Button>
                                    )}
                                    {/* Accept/Reject Buttons */}
                                    {doc.summary_json && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`shrink-0 ${(doc as any).status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' : 'hover:bg-green-50 hover:text-green-700'}`}
                                                onClick={async () => {
                                                    try {
                                                        await api.updateDPRStatus(doc.id, 'accepted')
                                                        if (id) loadProjectData(parseInt(id))
                                                    } catch (err) {
                                                        console.error('Error accepting DPR:', err)
                                                        alert('Failed to accept DPR')
                                                    }
                                                }}
                                                title="Accept DPR"
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`shrink-0 ${(doc as any).status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'hover:bg-red-50 hover:text-red-700'}`}
                                                onClick={async () => {
                                                    try {
                                                        await api.updateDPRStatus(doc.id, 'rejected')
                                                        if (id) loadProjectData(parseInt(id))
                                                    } catch (err) {
                                                        console.error('Error rejecting DPR:', err)
                                                        alert('Failed to reject DPR')
                                                    }
                                                }}
                                                title="Reject DPR"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                    {/* Feedback Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`shrink-0 ${doc.admin_feedback ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' : ''}`}
                                        onClick={() => setFeedbackDpr(doc)}
                                        title={doc.admin_feedback ? 'Edit Feedback' : 'Add Feedback'}
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </main>



            {/* Comparison Results Modal */}
            {showComparisonModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="w-full max-w-4xl p-6 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Scale className="h-6 w-6 text-purple-600" />
                                DPR Comparison Results
                            </h2>
                            <button
                                onClick={() => setShowComparisonModal(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {comparisonError ? (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-red-600">Comparison Failed</p>
                                <p className="text-muted-foreground">{comparisonError}</p>
                            </div>
                        ) : comparisonResult && (
                            <div className="space-y-6">
                                {/* Best DPR Recommendation */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-green-500 p-3 rounded-full">
                                            <Trophy className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-green-700 dark:text-green-400 mb-1">
                                                🏆 Best DPR: {comparisonResult.bestDprName}
                                            </h3>
                                            <p className="text-green-600 dark:text-green-300">
                                                {comparisonResult.recommendation}
                                            </p>
                                            <Button
                                                className="mt-4 bg-green-600 hover:bg-green-700"
                                                onClick={() => navigate(`/admin/documents/${comparisonResult.bestDprId}`)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                View Best DPR
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Comparison Summary */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Comparison Summary</h3>
                                    <p className="text-muted-foreground">{comparisonResult.comparisonSummary}</p>
                                </div>

                                {/* Key Metrics */}
                                {comparisonResult.keyMetrics && comparisonResult.keyMetrics.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Key Metrics Comparison</h3>
                                        <div className="grid gap-3">
                                            {comparisonResult.keyMetrics.map((metric: any, idx: number) => (
                                                <div key={idx} className="bg-muted/50 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium">{metric.metric}</span>
                                                        <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                                                            Winner: {metric.winner}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{metric.analysis}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Individual DPR Analysis */}
                                {comparisonResult.dprAnalysis && comparisonResult.dprAnalysis.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Individual DPR Analysis</h3>
                                        <div className="grid gap-4">
                                            {comparisonResult.dprAnalysis.map((dpr: any) => (
                                                <Card
                                                    key={dpr.dprId}
                                                    className={`p-4 ${dpr.dprId === comparisonResult.bestDprId ? 'border-green-500 border-2' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            {dpr.dprId === comparisonResult.bestDprId && (
                                                                <Trophy className="h-5 w-5 text-green-500" />
                                                            )}
                                                            <h4 className="font-semibold">{dpr.dprName}</h4>
                                                        </div>
                                                        <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
                                                            Score: {dpr.overallScore}/10
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-muted-foreground mb-3">{dpr.verdict}</p>

                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                                                                <CheckCircle className="h-4 w-4" /> Strengths
                                                            </h5>
                                                            <ul className="text-sm space-y-1">
                                                                {dpr.strengths?.map((s: string, i: number) => (
                                                                    <li key={i} className="text-muted-foreground">• {s}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                                                                <AlertCircle className="h-4 w-4" /> Weaknesses
                                                            </h5>
                                                            <ul className="text-sm space-y-1">
                                                                {dpr.weaknesses?.map((w: string, i: number) => (
                                                                    <li key={i} className="text-muted-foreground">• {w}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-3"
                                                        onClick={() => navigate(`/admin/documents/${dpr.dprId}`)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View DPR
                                                    </Button>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end mt-6">
                            <Button variant="outline" onClick={() => setShowComparisonModal(false)}>
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Compliance Weights Modal */}
            {id && (
                <ComplianceWeightsModal
                    projectId={parseInt(id)}
                    isOpen={showComplianceWeights}
                    onClose={() => setShowComplianceWeights(false)}
                    onSuccess={() => {
                        // Reload project data after weights are updated and scores recalculated
                        loadProjectData(parseInt(id))
                    }}
                />
            )}

            {/* Feedback Modal */}
            {feedbackDpr && (
                <FeedbackModal
                    dpr={feedbackDpr}
                    isOpen={true}
                    onClose={() => setFeedbackDpr(null)}
                    onSuccess={() => {
                        // Reload project data after feedback is updated
                        if (id) {
                            loadProjectData(parseInt(id))
                        }
                    }}
                />
            )}
        </div>
    )
}
