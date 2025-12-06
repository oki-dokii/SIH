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
    X
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type DPR, type Project } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ProjectDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const { language, t } = useLanguage()
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
            await api.uploadDPR(file, language, parseInt(id), (progress) => {
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
        if (doc.summary_json) {
            return { label: t('projectDetail.completed'), color: 'text-green-600', bg: 'bg-green-50' }
        }
        return { label: t('projectDetail.processing'), color: 'text-blue-600', bg: 'bg-blue-50' }
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
                        <Button size="lg" onClick={handleUploadClick} disabled={uploading}>
                            {uploading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <div className="w-20 h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-foreground transition-all duration-300"
                                            style={{ width: `${Math.max(5, uploadProgress)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs">{Math.round(uploadProgress)}%</span>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload PDF
                                </>
                            )}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                        />
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
                            {searchQuery ? t('projectDetail.differentSearchTerm') : t('projectDetail.uploadFirst')}
                        </p>
                        <Button onClick={handleUploadClick}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload PDF
                        </Button>
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
                                    <Button
                                        size="sm"
                                        className="flex-1 md:flex-none"
                                        onClick={() => navigate(`/admin/documents/${doc.id}`)}
                                        disabled={!doc.summary_json}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Analysis
                                    </Button>
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
        </div>
    )
}
