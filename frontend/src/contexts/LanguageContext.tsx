import { createContext, useContext, ReactNode } from 'react'
import { getTranslation } from '../lib/i18n'

interface LanguageContextType {
  language: 'en'
  setLanguage: (lang: 'en') => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Language is now fixed to English only
  const language = 'en' as const

  // setLanguage is a no-op now since we only support English
  const setLanguage = () => { }

  const t = (key: string) => getTranslation('en', key)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
