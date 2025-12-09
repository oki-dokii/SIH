import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '@/contexts/RoleContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Upload, FileText, Download, Clock, Trash2, MessageSquare, X } from 'lucide-react'
import { LanguageDropdown } from '@/components/LanguageDropdown'

interface ClientDPR {
    id: number
    client_id: number
    project_name: string
    dpr_filename: string
    original_filename: string
    status: string
    created_at: string
    admin_feedback?: string
    feedback_timestamp?: string
}

interface Project {
    id: number
    name: string
    state: string
    scheme: string
    sector: string
}

export default function ClientDashboard() {
    const navigate = useNavigate()
    const { userInfo, logoutUser } = useRole()
    const [dprs, setDprs] = useState<ClientDPR[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [selectedFeedback, setSelectedFeedback] = useState<ClientDPR | null>(null)

    // Form state
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    useEffect(() => {
        if (!userInfo) {
            navigate('/user/auth')
            return
        }
        fetchDPRs()
        fetchProjects()
    }, [userInfo, navigate])

    const fetchProjects = async () => {
        try {
            setLoadingProjects(true)
            const response = await fetch('http://127.0.0.1:8000/projects')
            if (!response.ok) throw new Error('Failed to fetch projects')
            const data = await response.json()
            setProjects(data.projects)
        } catch (err) {
            setError('Failed to load projects. Please try again.')
            console.error('Fetch projects error:', err)
        } finally {
            setLoadingProjects(false)
        }
    }

    const fetchDPRs = async () => {
        if (!userInfo) return

        try {
            setLoading(true)
            const response = await fetch(`http://127.0.0.1:8000/api/client/dprs?client_id=${userInfo.id}`)
            if (!response.ok) throw new Error('Failed to fetch DPRs')
            const data = await response.json()
            setDprs(data.dprs)
        } catch (err) {
            setError('Failed to load your DPRs. Please try again.')
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                setError('Only PDF files are allowed.')
                return
            }
            setSelectedFile(file)
            setError(null)
        }
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!userInfo) {
            setError('You must be logged in to upload DPRs.')
            return
        }

        if (!selectedProjectId) {
            setError('Please select a project.')
            return
        }

        if (!selectedFile) {
            setError('Please select a PDF file.')
            return
        }

        setUploading(true)
        setError(null)
        setSuccessMessage(null)

        try {
            // Get the selected project name
            const selectedProject = projects.find(p => p.id === selectedProjectId)
            if (!selectedProject) {
                throw new Error('Selected project not found')
            }

            const formData = new FormData()
            formData.append('client_id', userInfo.id.toString())
            formData.append('project_id', selectedProjectId.toString())
            formData.append('project_name', selectedProject.name)
            formData.append('file', selectedFile)

            const response = await fetch('http://127.0.0.1:8000/api/client/dprs/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Upload failed')
            }

            const result = await response.json()
            setSuccessMessage(result.message)
            setSelectedProjectId(null)
            setSelectedFile(null)

            // Reset file input
            const fileInput = document.getElementById('dpr-file') as HTMLInputElement
            if (fileInput) fileInput.value = ''

            // Refresh the DPR list
            await fetchDPRs()
        } catch (err: any) {
            setError(err.message || 'Failed to upload DPR. Please try again.')
            console.error('Upload error:', err)
        } finally {
            setUploading(false)
        }
    }

    const handleDownload = async (dpr: ClientDPR) => {
        if (!userInfo) return

        try {
            const response = await fetch(
                `http://127.0.0.1:8000/api/client/dprs/${dpr.id}/download?client_id=${userInfo.id}`
            )

            if (!response.ok) throw new Error('Failed to download file')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = dpr.original_filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            setError('Failed to download file. Please try again.')
            console.error('Download error:', err)
        }
    }

    const handleDelete = async (dpr: ClientDPR) => {
        if (!userInfo) return

        console.log('Delete clicked for DPR:', dpr)

        if (!confirm(`Are you sure you want to delete "${dpr.original_filename}"? This action cannot be undone.`)) {
            console.log('Delete cancelled by user')
            return
        }

        try {
            const url = `http://127.0.0.1:8000/api/client/dprs/${dpr.id}?client_id=${userInfo.id}`
            console.log('Sending DELETE request to:', url)

            const response = await fetch(url, { method: 'DELETE' })

            console.log('DELETE response status:', response.status)

            if (!response.ok) {
                const errorData = await response.json()
                console.error('DELETE error response:', errorData)
                throw new Error(errorData.detail || 'Failed to delete')
            }

            const result = await response.json()
            console.log('DELETE success:', result)
            setSuccessMessage(result.message)

            // Refresh the DPR list
            await fetchDPRs()
        } catch (err: any) {
            console.error('Delete error:', err)
            setError(err.message || 'Failed to delete DPR. Please try again.')
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const handleLogout = () => {
        logoutUser()
        navigate('/')
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-primary">DPR Analyzer</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageDropdown />
                        <span className="text-sm text-muted-foreground">
                            Welcome, <span className="font-medium text-foreground">{userInfo?.name || 'User'}</span>
                        </span>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">My DPR Projects</h1>
                    <p className="text-muted-foreground">Upload and manage your DPR documents</p>
                </div>

                {/* Upload Form */}
                <Card className="p-6 mb-8">
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <Upload className="h-6 w-6 text-primary" />
                        Upload New DPR
                    </h2>

                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label htmlFor="project-select" className="block text-sm font-medium mb-2">
                                Select Project <span className="text-red-500">*</span>
                            </label>
                            {loadingProjects ? (
                                <div className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground">
                                    Loading projects...
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="space-y-2">
                                    <div className="w-full px-4 py-2 border border-orange-300 bg-orange-50 rounded-lg text-orange-700 text-sm">
                                        No projects available. Please ask an admin to create projects first.
                                    </div>
                                </div>
                            ) : (
                                <select
                                    id="project-select"
                                    value={selectedProjectId || ''}
                                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                    required
                                    disabled={uploading}
                                >
                                    <option value="">-- Select a project --</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name} ({project.state} - {project.scheme})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label htmlFor="dpr-file" className="block text-sm font-medium mb-2">
                                Upload DPR (PDF only) <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="dpr-file"
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary/90"
                                required
                                disabled={uploading}
                            />
                            {selectedFile && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    Selected: {selectedFile.name}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {successMessage && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                                {successMessage}
                            </div>
                        )}

                        <Button type="submit" disabled={uploading} className="w-full sm:w-auto">
                            {uploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload DPR
                                </>
                            )}
                        </Button>
                    </form>
                </Card>

                {/* DPR List */}
                <Card className="p-6">
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Your DPRs
                    </h2>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground mt-4">Loading your DPRs...</p>
                        </div>
                    ) : dprs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <p className="text-muted-foreground text-lg">You haven't uploaded any DPRs yet.</p>
                            <p className="text-sm text-muted-foreground mt-2">Use the form above to upload your first DPR document.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-semibold">Project Name</th>
                                        <th className="text-left py-3 px-4 font-semibold">DPR Uploaded</th>
                                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold">Uploaded On</th>
                                        <th className="text-left py-3 px-4 font-semibold">Admin Feedback</th>
                                        <th className="text-center py-3 px-4 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dprs.map((dpr) => (
                                        <tr key={dpr.id} className="border-b hover:bg-muted/50 transition-colors">
                                            <td className="py-4 px-4 font-medium">{dpr.project_name}</td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground">{dpr.original_filename}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${dpr.status === 'accepted'
                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                    : dpr.status === 'rejected'
                                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                                        : dpr.status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                    }`}>
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {dpr.status === 'accepted' ? 'Accepted'
                                                        : dpr.status === 'rejected' ? 'Rejected'
                                                            : dpr.status === 'pending' ? 'Pending Review'
                                                                : dpr.status === 'completed' ? 'Under Review'
                                                                    : dpr.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-muted-foreground">
                                                {formatDate(dpr.created_at)}
                                            </td>
                                            <td className="py-4 px-4">
                                                {dpr.admin_feedback ? (
                                                    <div className="max-w-xs">
                                                        <p className="text-sm text-foreground line-clamp-2" title={dpr.admin_feedback}>
                                                            {dpr.admin_feedback}
                                                        </p>
                                                        {dpr.feedback_timestamp && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {new Date(dpr.feedback_timestamp).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedFeedback(dpr)}
                                                            className="mt-2 text-xs inline-flex items-center gap-1"
                                                        >
                                                            <MessageSquare className="h-3 w-3" />
                                                            View Full Feedback
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">No feedback yet</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownload(dpr)}
                                                        className="inline-flex items-center gap-2"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDelete(dpr)}
                                                        className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </main>

            {/* Footer */}
            <footer className="border-t py-6 mt-12">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    © 2025 <span className="text-primary font-semibold">DPR Analyzer</span> - All rights reserved
                </div>
            </footer>

            {/* Feedback Modal */}
            {selectedFeedback && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <MessageSquare className="h-6 w-6 text-primary" />
                                    Admin Feedback
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    For: {selectedFeedback.original_filename}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedFeedback(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <div className="bg-muted/50 rounded-lg p-4">
                                <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {selectedFeedback.admin_feedback}
                                </p>
                            </div>
                            {selectedFeedback.feedback_timestamp && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Received on: {new Date(selectedFeedback.feedback_timestamp).toLocaleString()}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}