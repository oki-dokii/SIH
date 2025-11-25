import { useState, useEffect } from 'react'
import { api, type Project } from '@/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { X, Loader2, Folder, Search } from 'lucide-react'

interface ProjectSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (projectId: number) => void
}

export function ProjectSelectionModal({ isOpen, onClose, onSelect }: ProjectSelectionModalProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (isOpen) {
            loadProjects()
            setSelectedId(null)
            setSearchQuery('')
        }
    }, [isOpen])

    const loadProjects = async () => {
        try {
            setLoading(true)
            const data = await api.getProjects()
            setProjects(data)
        } catch (err) {
            setError('Failed to load projects')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.scheme.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.sector.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold">Select Project</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <p className="text-muted-foreground mb-4 shrink-0">
                    Choose a project to add this document to.
                </p>

                <div className="relative mb-4 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mb-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {projects.length === 0 ? "No projects found. Please create a project first." : "No matching projects found."}
                        </div>
                    ) : (
                        filteredProjects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => setSelectedId(project.id)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${selectedId === project.id
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'hover:border-primary/50 hover:bg-muted/50'
                                    }`}
                            >
                                <Folder className={`h-5 w-5 ${selectedId === project.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium truncate">{project.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {project.state} • {project.scheme}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex gap-3 shrink-0 mt-auto">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        disabled={!selectedId}
                        onClick={() => selectedId && onSelect(selectedId)}
                    >
                        Continue
                    </Button>
                </div>
            </Card>
        </div>
    )
}
