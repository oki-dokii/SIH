import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
    Search,
    Filter,
    ChevronDown,
    Folder,
    Plus,
    Calendar,
    Loader2,
    MapPin,
    Briefcase,
    Layers,
    X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

// Dropdown Options
const STATE_OPTIONS = [
    'Arunachal Pradesh', 'Assam', 'Delhi', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'
]

const SCHEME_OPTIONS = [
    'NESIDS-OTRI', 'NESIDS-ROADS', 'PM-DevINE', 'Schemes of NEC', 'Special Packages'
]

const SECTOR_OPTIONS: Record<string, string[]> = {
    'All': ['Agriculture and Allied', 'Chose...', 'Education', 'Evaluation and Monitoring', 'Health', 'Industries',
        'Information and Public Relation', 'Infrastructure', 'Irrigation and Flood Control', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Science and Technology', 'Sports', 'Tourism and Culture', 'Transport and Communication', 'Water Supply'
    ],
    'NESIDS-OTRI': ['Agriculture and Allied', 'Chose...', 'Education', 'Health', 'Irrigation and Flood Control', 'Miscellaneous',
        'Power', 'Roads and Bridges', 'Sports', 'Tourism and Culture', 'Transport and Communication', 'Water Supply'
    ],
    'NESIDS-ROADS': ['Roads and Bridges', 'Transport and Communication'
    ],
    'PM-DevINE': ['Agriculture and Allied', 'Education', 'Health', 'Infrastructure', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Sports', 'Tourism and Culture'
    ],
    'Schemes of NEC': ['Agriculture and Allied', 'Education', 'Health', 'Infrastructure', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Sports', 'Tourism and Culture'
    ],
    'Special Packages': ['Agriculture and Allied', 'Education', 'Health', 'Infrastructure', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Sports', 'Tourism and Culture'
    ]
}

export default function ProjectsPage() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const [searchQuery, setSearchQuery] = useState('')
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filter State
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState({
        state: 'ALL',
        scheme: 'ALL',
        sector: 'ALL'
    })

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newProject, setNewProject] = useState({
        name: '',
        state: STATE_OPTIONS[0],
        scheme: SCHEME_OPTIONS[0],
        sector: SECTOR_OPTIONS[SCHEME_OPTIONS[0]][0]
    })
    const [creating, setCreating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    // Delete Modal State
    const [projectToDelete, setProjectToDelete] = useState<number | null>(null)

    useEffect(() => {
        loadProjects()
    }, [])

    // Update sector when scheme changes (Forward Dependency)
    useEffect(() => {
        if (newProject.scheme) {
            const validSectors = SECTOR_OPTIONS[newProject.scheme] || SECTOR_OPTIONS['All']
            if (!validSectors.includes(newProject.sector)) {
                setNewProject(prev => ({ ...prev, sector: validSectors[0] }))
            }
        }
    }, [newProject.scheme])

    // Update scheme when sector changes (Reverse Dependency)
    // We don't automatically change scheme, but we filter the options in the render

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
            setValidationError(t('projects.validationName'))
            return
        }
        if (!newProject.state) {
            setValidationError(t('projects.validationState'))
            return
        }
        if (!newProject.scheme) {
            setValidationError(t('projects.validationScheme'))
            return
        }
        if (!newProject.sector) {
            setValidationError(t('projects.validationSector'))
            return
        }

        try {
            setCreating(true)
            setValidationError(null)
            await api.createProject({
                name: newProject.name,
                state: newProject.state,
                scheme: newProject.scheme,
                sector: newProject.sector
            })
            setIsModalOpen(false)
            setNewProject({
                name: '',
                state: STATE_OPTIONS[1],
                scheme: SCHEME_OPTIONS[1],
                sector: SECTOR_OPTIONS[SCHEME_OPTIONS[1]][0]
            })
            setValidationError(null)
            loadProjects()
        } catch (err) {
            setValidationError(t('projects.creatingFailed'))
            console.error('Error creating project:', err)
        } finally {
            setCreating(false)
        }
    }

    const confirmDelete = async () => {
        if (!projectToDelete) return

        try {
            console.log('Calling deleteProject API for:', projectToDelete)
            await api.deleteProject(projectToDelete)
            console.log('Delete successful, updating state')
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

    // Get valid schemes based on selected sector
    const getValidSchemes = () => {
        if (!newProject.sector) return SCHEME_OPTIONS
        return SCHEME_OPTIONS.filter(scheme => {
            const sectors = SECTOR_OPTIONS[scheme] || []
            return sectors.includes(newProject.sector)
        })
    }

    // Get valid sectors based on selected scheme
    const getValidSectors = () => {
        return SECTOR_OPTIONS[newProject.scheme] || SECTOR_OPTIONS['All']
    }

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesState = filters.state === 'ALL' || p.state === filters.state
        const matchesScheme = filters.scheme === 'ALL' || p.scheme === filters.scheme
        const matchesSector = filters.sector === 'ALL' || p.sector === filters.sector
        return matchesSearch && matchesState && matchesScheme && matchesSector
    })

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

                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder={t('projects.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <Button
                            variant={showFilters ? "primary" : "outline"}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            {t('projects.filter')}
                            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.state')}</label>
                                <select
                                    value={filters.state}
                                    onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="ALL">ALL</option>
                                    {STATE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.scheme')}</label>
                                <select
                                    value={filters.scheme}
                                    onChange={(e) => setFilters({ ...filters, scheme: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="ALL">ALL</option>
                                    {SCHEME_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.sector')}</label>
                                <select
                                    value={filters.sector}
                                    onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="ALL">ALL</option>
                                    {SECTOR_OPTIONS['All'].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
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
                            {searchQuery || showFilters ? t('projects.tryAdjusting') : t('projects.noProjectsDesc')}
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
                            onClick={() => navigate(`/admin/projects/${project.id}`)}
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
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {project.state}
                                        </span>
                                        <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                                            <Layers className="h-3 w-3 mr-1" />
                                            {project.scheme}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-4 border-t">
                                <div className="flex items-center gap-1">
                                    <Briefcase className="h-4 w-4" />
                                    {project.sector}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(project.created_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="mt-4 text-sm font-medium text-primary">
                                {project.dpr_count || 0} Documents
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
                                <label className="block text-sm font-medium mb-1">{t('projects.projectName')} <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder={t('projects.projectNamePlaceholder')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.state')} <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.state}
                                    onChange={(e) => setNewProject({ ...newProject, state: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {STATE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.scheme')} <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.scheme}
                                    onChange={(e) => setNewProject({ ...newProject, scheme: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {SCHEME_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">{t('projects.sector')} <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.sector}
                                    onChange={(e) => setNewProject({ ...newProject, sector: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {getValidSectors().map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
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
                            Are you sure you want to delete this project? This action cannot be undone and all associated DPRs will be unlinked.
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
