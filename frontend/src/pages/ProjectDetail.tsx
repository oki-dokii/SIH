import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
    Search,
    Filter,
    ChevronDown,
    FileText,
    Eye,
    Trash2,
    Upload,
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
    Settings
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type DPR, type Project } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import ComplianceWeightsModal from '@/components/ComplianceWeightsModal'

export default function ProjectDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const { t } = useLanguage()
    const [project, setProject] = useState<Project | null>(null)
    const [documents, setDocuments] = useState<DPR[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Delete Modal State
    const [dprToDelete, setDprToDelete] = useState<number | null>(null)

    // Analyzing state
    const [analyzingDpr, setAnalyzingDpr] = useState<number | null>(null)

    // Compare All state
    const [comparing, setComparing] = useState(false)
    const [showComparisonModal, setShowComparisonModal] = useState(false)
    const [comparisonResult, setComparisonResult] = useState<any>(null)
    const [comparisonError, setComparisonError] = useState<string | null>(null)

    // Compliance Weights Modal state
    const [showComplianceWeights, setShowComplianceWeights] = useState(false)

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

    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]

        if (!file || !id) {
            return
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert(t('projectDetail.uploadPdfOnly'))
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            await api.uploadDPR(file, parseInt(id), (progress) => {
                setUploadProgress(progress)
            })

            // Reload to get new DPR
            await loadProjectData(parseInt(id))
        } catch (err) {
            console.error('Upload error:', err)
            alert(t('projectDetail.uploadingError'))
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const confirmDelete = async () => {
        if (!dprToDelete) return

        try {
            console.log('Calling deleteDPR API for:', dprToDelete)
            await api.deleteDPR(dprToDelete)
            console.log('Delete successful, updating state')
            setDocuments(documents.filter(doc => doc.id !== dprToDelete))
            setDprToDelete(null)
        } catch (err) {
            alert(t('projectDetail.deleteDocumentFailed'))
            console.error('Error deleting document:', err)
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, dprId: number) => {
        e.stopPropagation()
        setDprToDelete(dprId)
    }

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

                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('projectDetail.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <Button variant="outline">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                        <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
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
                        return (
                            <Card key={doc.id} className="p-4 hover:border-primary/40 transition-all flex flex-col md:flex-row items-start md:items-center gap-4">
                                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate" title={doc.original_filename}>{doc.original_filename}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full ${status.bg} ${status.color} font-medium`}>
                                            {status.label}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(doc.upload_ts)}
                                        </span>
                                    </div>
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => handleDeleteClick(e, doc.id)}
                                        title={t('projectDetail.deleteDocument')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </main>

            {/* Delete Confirmation Modal */}
            {dprToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-red-600">{t('projectDetail.deleteDocument')}</h2>
                            <button onClick={() => setDprToDelete(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this document? This action cannot be undone.
                        </p>

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setDprToDelete(null)}>
                                Cancel
                            </Button>
                            <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
                                Delete Document
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

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
        </div>
    )
}
