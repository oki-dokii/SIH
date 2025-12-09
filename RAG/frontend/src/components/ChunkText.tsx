import { ReactNode, useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface ChunkTextProps {
    text: string
    pdfId: number
    onPageNavigate?: (pageNumber: number) => void
}

/**
 * Component that renders text with clickable chunk references.
 * Detects patterns like [Chunk 23] and replaces them with [Page 15] (actual page number).
 * 
 * When clicked:
 * - Navigates to the page in PDF viewer using onPageNavigate callback
 */
export function ChunkText({ text, pdfId, onPageNavigate }: ChunkTextProps) {
    const [processedText, setProcessedText] = useState<ReactNode[]>([text])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function processChunks() {
            // Regex to match [Chunk N] patterns
            const chunkPattern = /\[Chunk (\d+)\]/g
            const matches = [...text.matchAll(chunkPattern)]

            if (matches.length === 0) {
                setProcessedText([text])
                setLoading(false)
                return
            }

            // Fetch metadata for all chunks
            const chunkDataPromises = matches.map(match => {
                const chunkIndex = parseInt(match[1])
                return api.getChunk(pdfId, chunkIndex).catch(() => null)
            })

            const chunkDataArray = await Promise.all(chunkDataPromises)

            // Build replacement map: chunk_index -> page_number
            const chunkToPage: Record<number, number> = {}
            matches.forEach((match, idx) => {
                const chunkIndex = parseInt(match[1])
                const chunkData = chunkDataArray[idx]
                if (chunkData?.metadata?.page) {
                    chunkToPage[chunkIndex] = chunkData.metadata.page
                }
            })

            // Render text with clickable page references
            const elements: ReactNode[] = []
            let lastIndex = 0
            chunkPattern.lastIndex = 0

            let match
            while ((match = chunkPattern.exec(text)) !== null) {
                const fullMatch = match[0]
                const chunkNumber = parseInt(match[1])
                const pageNumber = chunkToPage[chunkNumber]
                const matchIndex = match.index

                // Add text before the match
                if (matchIndex > lastIndex) {
                    elements.push(text.substring(lastIndex, matchIndex))
                }

                // Add clickable page/chunk reference
                const displayText = pageNumber ? `Page ${pageNumber}` : fullMatch
                elements.push(
                    <button
                        key={`chunk-${chunkNumber}-${matchIndex}`}
                        onClick={() => pageNumber && onPageNavigate?.(pageNumber)}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer font-medium text-sm underline decoration-dotted"
                        title={pageNumber ? `Click to view page ${pageNumber}` : 'Page info unavailable'}
                    >
                        {displayText}
                    </button>
                )

                lastIndex = matchIndex + fullMatch.length
            }

            // Add remaining text
            if (lastIndex < text.length) {
                elements.push(text.substring(lastIndex))
            }

            setProcessedText(elements)
            setLoading(false)
        }

        processChunks()
    }, [text, pdfId, onPageNavigate])

    if (loading) {
        return <span className="text-gray-400">Loading...</span>
    }

    return <>{processedText}</>
}
