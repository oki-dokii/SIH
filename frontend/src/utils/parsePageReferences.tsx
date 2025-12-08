import React from 'react'

/**
 * Detect page numbers in text using various common patterns
 * Matches: "page 8", "Page 12", "pg. 5", "p. 23"
 */
export function detectPageReferences(text: string): number[] {
    if (!text) return []

    const pageReferencePattern = /\b(?:page|Page|PAGE|pg\.|Pg\.|p\.|P\.)\s*(\d+)\b/gi
    const matches = text.matchAll(pageReferencePattern)

    const pageNumbers = new Set<number>()
    for (const match of matches) {
        const pageNum = parseInt(match[1], 10)
        if (pageNum > 0) {
            pageNumbers.add(pageNum)
        }
    }

    return Array.from(pageNumbers).sort((a, b) => a - b)
}

/**
 * Transform text to include clickable page references
 * Returns JSX with clickable links for page numbers
 */
export function createClickablePageLinks(
    text: string,
    onPageClick: (page: number) => void
): React.ReactNode {
    if (!text) return text

    const pageReferencePattern = /\b(page|Page|PAGE|pg\.|Pg\.|p\.|P\.)\s*(\d+)\b/gi
    const parts: (string | React.ReactNode)[] = []
    let lastIndex = 0

    const matches = Array.from(text.matchAll(pageReferencePattern))

    matches.forEach((match, idx) => {
        const matchStart = match.index!
        const matchEnd = matchStart + match[0].length

        // Add text before the match
        if (matchStart > lastIndex) {
            parts.push(text.substring(lastIndex, matchStart))
        }

        // Add clickable page reference
        const pageNum = parseInt(match[2], 10)
        parts.push(
            <button
                key={`page-ref-${idx}-${pageNum}`}
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onPageClick(pageNum)
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium transition-colors"
                title={`Jump to page ${pageNum}`}
            >
                {match[0]}
            </button>
        )

        lastIndex = matchEnd
    })

    // Add remaining text after last match
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? <>{parts}</> : text
}

/**
 * Recursively parse JSON object and extract all page references
 */
export function extractAllPageReferences(data: any): number[] {
    const pageNumbers = new Set<number>()

    function traverse(obj: any) {
        if (typeof obj === 'string') {
            const refs = detectPageReferences(obj)
            refs.forEach(num => pageNumbers.add(num))
        } else if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item))
        } else if (obj && typeof obj === 'object') {
            Object.values(obj).forEach(value => traverse(value))
        }
    }

    traverse(data)
    return Array.from(pageNumbers).sort((a, b) => a - b)
}
