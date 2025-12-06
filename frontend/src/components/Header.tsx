import { FileText, Moon, Sun, Languages, CheckCircle2, LogOut } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui/Button'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { useRole } from '../contexts/RoleContext'
import { api } from '@/lib/api'
import { ProjectSelectionModal } from './ProjectSelectionModal'
import { Card } from './ui/Card'

export function Header() {
  const [isDark, setIsDark] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const { setRole } = useRole()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Project Selection & Upload State
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark')
    setIsDark(!isDark)
  }

  const isActive = (path: string) => location.pathname === path

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en')
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file')
      return
    }

    setPendingFile(file)
    setIsProjectModalOpen(true)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleProjectSelect = async (projectId: number) => {
    if (!pendingFile) return

    setIsProjectModalOpen(false)
    setUploading(true)
    setProcessing(false)
    setUploadSuccess(false)
    setUploadProgress(0)

    try {
      const result = await api.uploadDPR(pendingFile, language, projectId, (progress) => {
        setUploadProgress(progress)
        if (progress === 100) {
          setProcessing(true)
        }
      })

      setUploadSuccess(true)
      // Small delay to show success message before redirect
      setTimeout(() => {
        setUploading(false)
        navigate(`/documents/${result.id}`)
      }, 1500)
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload file. Please try again.')
      setUploading(false)
    } finally {
      setPendingFile(null)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-primary">{t('landing.title')}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive('/') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
              )}
            >
              {t('common.home')}
            </Link>
            <Link
              to="/projects"
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive('/projects') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
              )}
            >
              {t('common.projects')}
            </Link>
            <Link
              to="/comparisons"
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive('/comparisons') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
              )}
            >
              {t('common.comparisons')}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
              aria-label="Toggle language"
            >
              <Languages className="h-5 w-5" />
              <span className="text-sm font-medium">{language === 'en' ? 'हिं' : 'EN'}</span>
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Button onClick={handleUploadClick}>
              <FileText className="h-4 w-4" />
              {t('common.upload')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRole(null)}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              Switch Role
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
      </header>

      <ProjectSelectionModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false)
          setPendingFile(null)
        }}
        onSelect={handleProjectSelect}
      />

      {/* Upload Progress Modal */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <Card className="w-full max-w-md p-8">
            <div className="text-center">
              {uploadSuccess ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <div className="mb-4 flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-green-600">Upload Complete!</h3>
                  <p className="text-muted-foreground">Redirecting to analysis...</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {processing ? 'Processing Document...' : t('common.loading')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {processing
                      ? 'Analyzing content with AI. This may take a moment.'
                      : t('landing.uploadPrompt')}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {processing ? '100%' : `${Math.round(uploadProgress)}%`}
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
