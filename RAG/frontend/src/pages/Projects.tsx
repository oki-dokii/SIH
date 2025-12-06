import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
    Search,
    Folder,
    Plus,
    Calendar,
    Loader2,
    FileText,
    X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ProjectsPage() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const [searchQuery, setSearchQuery] = useState('')
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newProject, setNewProject] = useState({
        name: '',
        description: ''
    })
    const [creating, setCreating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    // Delete Modal State
    const [projectToDelete, setProjectToDelete] = useState<number | null>(null)

    useEffect(() => {
        loadProjects()
    }, [])

    const loadProjects = async () => {
        try {
            setLoading(true)
            const data = await api.getProjects()
            setProjects(data)
        } catch (err) {
            setError('Failed to load projects')
            console.error('Error loading projects:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!newProject.name.trim()) {
            setValidationError('Project name is required')
            return
        }

        try {
            setCreating(true)
            setValidationError(null)
            await api.createProject({
                name: newProject.name,
                description: newProject.description
            })
            setIsModalOpen(false)
            setNewProject({
                name: '',
                description: ''
            })
            setValidationError(null)
            loadProjects()
        } catch (err) {
            setValidationError('Failed to create project')
            console.error('Error creating project:', err)
        } finally {
            setCreating(false)
        }
    }

    const confirmDelete = async () => {
        if (!projectToDelete) return

        try {
            await api.deleteProject(projectToDelete)
            setProjects(projects.filter(p => p.id !== projectToDelete))
            setProjectToDelete(null)
        } catch (err) {
            alert('Failed to delete project')
            console.error('Error deleting project:', err)
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, projectId: number) => {
        e.stopPropagation()
        setProjectToDelete(projectId)
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{t('projects.title')}</h1>
                        <p className="text-muted-foreground">{t('projects.subtitle')}</p>
                    </div>
                    <Button size="lg" onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('projects.addProject')}
                    </Button>
                </div>

                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('projects.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 mb-6">
                        {error}
                    </div>
                )}

                {!loading && !error && filteredProjects.length === 0 && (
                    <Card className="p-12 text-center">
                        <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{t('projects.noProjects')}</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery ? t('projects.tryAdjusting') : t('projects.noProjectsDesc')}
                        </p>
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Project
                        </Button>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project) => (
                        <Card
                            key={project.id}
                            className="p-6 hover:border-primary/40 transition-all cursor-pointer group relative"
                            onClick={() => navigate(`/projects/${project.id}`)}
                        >
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    onClick={(e) => handleDeleteClick(e, project.id)}
                                    className="p-2 bg-white/80 hover:bg-red-50 text-muted-foreground hover:text-red-600 rounded-full transition-colors shadow-sm border"
                                    title={t('projects.deleteProject')}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <Folder className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1 pr-8">
                                    <h3 className="font-semibold mb-1 line-clamp-2 text-lg">{project.name}</h3>
                                    {project.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-4 border-t">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(project.created_ts).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    {project.pdf_count || 0} PDFs
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </main>

            {/* Add Project Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{t('projects.addNewProject')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter project name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                                <textarea
                                    value={newProject.description}
                                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter project description"
                                    rows={3}
                                />
                            </div>

                            {validationError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
                                    {validationError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={creating}>
                                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Create Project
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {projectToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-red-600">{t('projects.deleteProject')}</h2>
                            <button onClick={() => setProjectToDelete(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this project? This action cannot be undone and all associated PDFs will be deleted.
                        </p>

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setProjectToDelete(null)}>
                                Cancel
                            </Button>
                            <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
                                Delete Project
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
