import { useState, useEffect } from 'react'
import { api, type Project } from '@/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { X, Loader2, Folder, Search, Plus } from 'lucide-react'

// Dropdown Options (same as Projects page)
const STATE_OPTIONS = [
    'Arunachal Pradesh', 'Assam', 'Delhi', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'
]

const SCHEME_OPTIONS = [
    'NESIDS-OTRI', 'NESIDS-ROADS', 'PM-DevINE', 'Schemes of NEC', 'Special Packages'
]

const SECTOR_OPTIONS: Record<string, string[]> = {
    'All': [ 'Agriculture and Allied', 'Education', 'Evaluation and Monitoring', 'Health', 'Industries',
        'Information and Public Relatio', 'Infrastructure', 'Irrigation and Flood Control', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Science and Technology', 'Sports', 'Tourism and Culture', 'Transport and Communication', 'Water Supply'
    ],
    'NESIDS-ROADS': [
        'Roads and Bridges', 'Transport and Communication'
    ],
    'NESIDS-OTRI': [
        'Agriculture and Allied', 'Choose...', 'Education', 'Health', 'Irrigation and Flood Control', 'Miscellaneous',
        'Power', 'Roads and Bridges', 'Sports', 'Tourism and Culture', 'Transport and Communication', 'Water Supply'
    ],
    'Schemes of NEC': [
        'Agriculture and Allied', 'Education', 'Evaluation and Monitoring', 'Health', 'Industries',
        'Information and Public Relatio', 'Irrigation and Flood Control', 'Power', 'Science and Technology',
        'Sports', 'Tourism and Culture', 'Transport and Communication'
    ],
    'PM-DevINE': [
        'Agriculture and Allied', 'Education', 'Health', 'Infrastructure', 'Miscellaneous', 'Power',
        'Roads and Bridges', 'Sports', 'Tourism and Culture'
    ],
    'Special Packages': [
        'Agriculture and Allied', 'Education', 'Health', 'Industries', 'Infrastructure', 'Irrigation and Flood Control',
        'Miscellaneous', 'Power', 'Roads and Bridges', 'Sports', 'Tourism and Culture', 'Water Supply'
    ]
}

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
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [creating, setCreating] = useState(false)

    // New project form state
    const [newProject, setNewProject] = useState({
        name: '',
        state: STATE_OPTIONS[0],
        scheme: SCHEME_OPTIONS[0],  
        sector: SECTOR_OPTIONS[SCHEME_OPTIONS[0]][0]
    })

    useEffect(() => {
        if (isOpen) {
            loadProjects()
            setSelectedId(null)
            setSearchQuery('')
            setShowCreateForm(false)
            setNewProject({
                name: '',
                state: STATE_OPTIONS[0],
                scheme: SCHEME_OPTIONS[0],
                sector: SECTOR_OPTIONS[SCHEME_OPTIONS[0]][0]
            })
            setError(null)
        }
    }, [isOpen])

    // Update sector when scheme changes (Forward Dependency)
    useEffect(() => {
        if (newProject.scheme) {
            const validSectors = SECTOR_OPTIONS[newProject.scheme] || SECTOR_OPTIONS['All']
            if (!validSectors.includes(newProject.sector)) {
                setNewProject(prev => ({ ...prev, sector: validSectors[0] }))
            }
        }
    }, [newProject.scheme])

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

    const handleCreateProject = async () => {
        // Validation
        if (!newProject.name.trim()) {
            setError('Please enter a project name')
            return
        }
        if (newProject.state === 'All') {
            setError('Please select a state')
            return
        }
        if (newProject.scheme === 'All') {
            setError('Please select a scheme')
            return
        }
        if (newProject.sector === 'All') {
            setError('Please select a sector')
            return
        }

        try {
            setCreating(true)
            setError(null)
            const result = await api.createProject(newProject)
            await loadProjects()
            setShowCreateForm(false)
            setNewProject({
                name: '',
                state: STATE_OPTIONS[0],
                scheme: SCHEME_OPTIONS[0],
                sector: SECTOR_OPTIONS[SCHEME_OPTIONS[0]][0]
            })
            setSelectedId(result.id)
        } catch (err) {
            setError('Failed to create project. Please try again.')
            console.error(err)
        } finally {
            setCreating(false)
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
                    <h2 className="text-xl font-bold">{showCreateForm ? 'Create New Project' : 'Select Project'}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {showCreateForm ? (
                    <>
                        <p className="text-muted-foreground mb-4 shrink-0">
                            Fill in the details to create a new project.
                        </p>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium mb-1">Project Name *</label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter project name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">State <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.state}
                                    onChange={(e) => setNewProject({ ...newProject, state: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    required
                                >
                                    {STATE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Scheme <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.scheme}
                                    onChange={(e) => setNewProject({ ...newProject, scheme: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    required
                                >
                                    {SCHEME_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Sector <span className="text-red-500">*</span></label>
                                <select
                                    value={newProject.sector}
                                    onChange={(e) => setNewProject({ ...newProject, sector: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    required
                                >
                                    {getValidSectors().map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 shrink-0 mt-auto">
                            <Button variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
                                Back
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleCreateProject}
                                disabled={creating}
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
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

                        <Button
                            variant="outline"
                            className="w-full mb-4 shrink-0"
                            onClick={() => setShowCreateForm(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Project
                        </Button>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mb-6">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : error ? (
                                <div className="text-red-500 text-center py-4">{error}</div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    {projects.length === 0 ? "No projects found. Create one to get started!" : "No matching projects found."}
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
                    </>
                )}
            </Card>
        </div>
    )
}
