import { useState, useRef, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LANGUAGES, LanguageCode, changeLanguage, getInitialLanguage } from '@/lib/googleTranslate'

export function LanguageDropdown() {
    const [isOpen, setIsOpen] = useState(false)
    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => getInitialLanguage())
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleLanguageSelect = (langCode: LanguageCode) => {
        if (langCode === currentLanguage) {
            setIsOpen(false)
            return
        }

        setCurrentLanguage(langCode)
        setIsOpen(false)

        // Change language and reload page
        changeLanguage(langCode)
    }

    const currentLang = LANGUAGES[currentLanguage]

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                aria-label="Select language"
                aria-expanded={isOpen}
            >
                <Globe className="h-5 w-5" />
                <span className="hidden sm:inline text-sm font-medium">
                    {currentLang.nativeName}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-background shadow-lg z-50 py-1">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                        Select Language
                    </div>

                    {Object.entries(LANGUAGES).map(([code, lang]) => (
                        <button
                            key={code}
                            onClick={() => handleLanguageSelect(code as LanguageCode)}
                            className={cn(
                                'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between',
                                currentLanguage === code && 'bg-muted'
                            )}
                        >
                            <div>
                                <div className="font-medium">{lang.nativeName}</div>
                                <div className="text-xs text-muted-foreground">{lang.name}</div>
                            </div>
                            {currentLanguage === code && (
                                <Check className="h-4 w-4 text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
