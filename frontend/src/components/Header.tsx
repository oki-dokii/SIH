import { FileText, Moon, Sun } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/Button'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Header() {
  const [isDark, setIsDark] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark')
    setIsDark(!isDark)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-primary">DPR Analyzer</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive('/') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
            )}
          >
            Home
          </Link>
          <Link
            to="/documents"
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive('/documents') ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'
            )}
          >
            Documents
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Button>
            <FileText className="h-4 w-4" />
            Upload PDF
          </Button>
        </div>
      </div>
    </header>
  )
}
