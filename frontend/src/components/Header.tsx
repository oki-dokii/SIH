import { FileText, Moon, Sun, Languages } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui/Button'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { api } from '@/lib/api'

export function Header() {
  const [isDark, setIsDark] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    try {
      const result = await api.uploadDPR(file, language)
      navigate(`/documents/${result.id}`)
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload file. Please try again.')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
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
            to="/documents"
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive('/documents') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
            )}
          >
            {t('common.documents')}
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
  )
}
