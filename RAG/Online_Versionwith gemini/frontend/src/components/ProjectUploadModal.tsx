import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Search, Loader2, Folder, FileText } from 'lucide-react'
import { api, type Project } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ProjectUploadModalProps {
    isOpen: boolean
    onClose: () => void
    file: File | null
    onUpload: (projectId: number) => Promise<void>
    progress?: number
}

export function ProjectUploadModal({ isOpen, onClose, file, onUpload, progress = 0 }: ProjectUploadModalProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadProjects()
            setSelectedProjectId(null)
            setSearchQuery('')
        }
    }, [isOpen])

    const loadProjects = async () => {
        try {
            setLoading(true)
            const data = await api.getProjects()
            setProjects(data)
        } catch (err) {
            console.error('Failed to load projects:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleConfirm = async () => {
        if (!selectedProjectId) return

        try {
            setUploading(true)
            await onUpload(selectedProjectId)
            onClose()
        } catch (err) {
            console.error('Upload failed:', err)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", isOpen ? "block" : "hidden")}>
            <div className="bg-background w-full max-w-md rounded-lg shadow-lg border p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Select Project</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <span className="sr-only">Close</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="space-y-4">
                    {file && (
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium truncate">{file.name}</span>
                        </div>
                    )}

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
                        {loading ? (
                            <div className="p-4 flex justify-center text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                {searchQuery ? 'No projects found' : 'No projects available'}
                            </div>
                        ) : (
                            filteredProjects.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => setSelectedProjectId(project.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                                        selectedProjectId === project.id && "bg-primary/5 border-l-4 border-primary"
                                    )}
                                >
                                    <Folder className={cn("h-4 w-4", selectedProjectId === project.id ? "text-primary" : "text-muted-foreground")} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{project.name}</div>
                                        <div className="text-xs text-muted-foreground">{project.state} • {project.scheme}</div>
                                    </div>
                                    {selectedProjectId === project.id && (
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleConfirm}
                            disabled={!selectedProjectId || uploading}
                        >
                            {uploading ? (
                                <div className="flex items-center gap-2 w-full">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <div className="flex-1 h-2 bg-primary/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${Math.max(5, progress)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs">{Math.round(progress)}%</span>
                                </div>
                            ) : (
                                'Upload Document'
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
