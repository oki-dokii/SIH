import { Globe } from 'lucide-react'
import { LANGUAGES, type LanguageCode, changeLanguage, getInitialLanguage } from '../lib/googleTranslate'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function LanguageDropdown() {
    const [currentLang, setCurrentLang] = useState<LanguageCode>('en')
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setCurrentLang(getInitialLanguage())
    }, [])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLanguageChange = (langCode: LanguageCode) => {
        if (langCode === currentLang) {
            setIsOpen(false)
            return
        }

        changeLanguage(langCode)
        // Page will reload, no need to close dropdown
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Select language"
            >
                <Globe className="h-5 w-5" />
                <span className="hidden sm:inline text-sm font-medium">
                    {LANGUAGES[currentLang].nativeName}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                    {(Object.entries(LANGUAGES) as [LanguageCode, typeof LANGUAGES[LanguageCode]][]).map(([code, lang]) => (
                        <button
                            key={code}
                            onClick={() => handleLanguageChange(code)}
                            className={cn(
                                'w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors',
                                currentLang === code && 'bg-muted font-semibold'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span>{lang.nativeName}</span>
                                {currentLang === code && (
                                    <span className="text-primary">✓</span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground">{lang.name}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}