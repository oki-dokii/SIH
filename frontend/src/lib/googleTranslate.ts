// Google Translate Integration Utilities

export const LANGUAGES = {
    en: { name: 'English', nativeName: 'English', googleCode: 'en' },
    hi: { name: 'Hindi', nativeName: 'हिंदी', googleCode: 'hi' },
    as: { name: 'Assamese', nativeName: 'অসমীয়া', googleCode: 'as' },
    bn: { name: 'Bengali', nativeName: 'বাংলা', googleCode: 'bn' },
    mni: { name: 'Manipuri', nativeName: 'মৈতৈলোন্', googleCode: 'mni-Mtei' },
    lus: { name: 'Mizo', nativeName: 'Mizo ṭawng', googleCode: 'lus' },
    ne: { name: 'Nepali', nativeName: 'नेपाली', googleCode: 'ne' },
    kha: { name: 'Khasi', nativeName: 'Ka Ktien Khasi', googleCode: 'kha' },
} as const

export type LanguageCode = keyof typeof LANGUAGES

declare global {
    interface Window {
        google?: {
            translate?: {
                TranslateElement: new (
                    options: {
                        pageLanguage: string
                        includedLanguages: string
                        layout?: number
                    },
                    elementId: string
                ) => void
            }
        }
        googleTranslateElementInit?: () => void
    }
}

/**
 * Load Google Translate script dynamically
 */
export function loadGoogleTranslateScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google?.translate) {
            resolve()
            return
        }

        // Check if script already exists
        const existingScript = document.querySelector(
            'script[src*="translate.google.com"]'
        )
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve())
            existingScript.addEventListener('error', () => reject())
            return
        }

        // Create and load script
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
        script.async = true
        script.onerror = () => reject(new Error('Failed to load Google Translate script'))

        document.head.appendChild(script)

        // Set up initialization callback
        window.googleTranslateElementInit = () => {
            resolve()
        }
    })
}

/**
 * Initialize Google Translate widget
 */
export function initGoogleTranslate(): void {
    if (!window.google?.translate?.TranslateElement) {
        console.warn('Google Translate not loaded yet')
        return
    }

    const includedLanguages = Object.values(LANGUAGES)
        .map(lang => lang.googleCode)
        .join(',')

    new window.google.translate.TranslateElement(
        {
            pageLanguage: 'en',
            includedLanguages,
            layout: 0, // SIMPLE layout (no banner)
        },
        'google_translate_element'
    )
}

/**
 * Get current language from googtrans cookie
 */
export function getLanguageFromCookie(): LanguageCode {
    const cookies = document.cookie.split(';')
    const googtransCookie = cookies.find(cookie =>
        cookie.trim().startsWith('googtrans=')
    )

    if (!googtransCookie) return 'en'

    // Cookie format: /en/hi or /auto/hi
    const value = googtransCookie.split('=')[1]
    const parts = value.split('/')
    const langCode = parts[2] || 'en'

    // Map Google code back to our code
    for (const [key, lang] of Object.entries(LANGUAGES)) {
        if (lang.googleCode === langCode) {
            return key as LanguageCode
        }
    }

    return 'en'
}

/**
 * Set googtrans cookie
 */
export function setLanguageCookie(langCode: LanguageCode): void {
    const googleCode = LANGUAGES[langCode].googleCode

    // Set cookie for root domain
    const cookieValue = `/en/${googleCode}`

    // Delete old cookie first
    document.cookie = 'googtrans=; path=/; max-age=0'

    // Set new cookie (expires in 1 year)
    const maxAge = 365 * 24 * 60 * 60 // 1 year in seconds
    document.cookie = `googtrans=${cookieValue}; path=/; max-age=${maxAge}`

    // Also set for compatibility
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname}; max-age=${maxAge}`
}

/**
 * Change language and reload page
 */
export function changeLanguage(langCode: LanguageCode): void {
    setLanguageCookie(langCode)
    // Save to localStorage for LanguageContext
    localStorage.setItem('selectedLanguage', langCode)
    // Reload page to apply Google Translate
    window.location.reload()
}

/**
 * Get initial language (from cookie or localStorage or browser)
 */
export function getInitialLanguage(): LanguageCode {
    // First check cookie (highest priority - set by Google Translate)
    const cookieLang = getLanguageFromCookie()
    if (cookieLang !== 'en') return cookieLang

    // Check localStorage
    const storedLang = localStorage.getItem('selectedLanguage') as LanguageCode
    if (storedLang && storedLang in LANGUAGES) return storedLang

    // Default to English
    return 'en'
}