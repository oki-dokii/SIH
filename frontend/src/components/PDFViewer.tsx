import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, FileX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface PDFViewerProps {
    pdfUrl: string
    initialPage?: number
    onPageChange?: (page: number) => void
    className?: string
}

export function PDFViewer({ pdfUrl, initialPage = 1, onPageChange, className = '' }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [scale, setScale] = useState<number>(1.0)
    const [error, setError] = useState<string | null>(null)
    const [pageInput, setPageInput] = useState<string>('1')

    // Debug logging
    useEffect(() => {
        console.log('📄 PDFViewer: Initializing with URL:', pdfUrl)
        console.log('📄 PDFViewer: Initial page:', initialPage)
    }, [])

    // Update page when initialPage changes (for external page jumps)
    useEffect(() => {
        if (initialPage > 0 && initialPage <= numPages) {
            console.log('📄 PDFViewer: External page jump to', initialPage)
            goToPage(initialPage)
        }
    }, [initialPage, numPages])

    // **CENTRAL FUNCTION**: Single source of truth for page changes
    function goToPage(pageNumber: number) {
        console.log('📄 PDFViewer: goToPage called with:', pageNumber, 'Total pages:', numPages)

        // Validate page number
        if (pageNumber < 1) {
            console.warn('📄 PDFViewer: Page number too low, setting to 1')
            pageNumber = 1
        }
        if (numPages > 0 && pageNumber > numPages) {
            console.warn('📄 PDFViewer: Page number too high, setting to', numPages)
            pageNumber = numPages
        }

        // Update all related state
        setCurrentPage(pageNumber)
        setPageInput(String(pageNumber))

        // Notify parent component
        if (onPageChange) {
            onPageChange(pageNumber)
        }

        console.log('📄 PDFViewer: Page changed to', pageNumber)
    }

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        console.log('✅ PDF loaded successfully! Total pages:', numPages)
        setNumPages(numPages)
        setError(null)

        // Set initial page
        goToPage(initialPage || 1)
    }

    function onDocumentLoadError(error: Error) {
        console.error('❌ PDF load error:', error)
        console.error('❌ PDF URL:', pdfUrl)
        setError(`Failed to load PDF: ${error.message}`)
    }

    // Navigation handlers - all use goToPage
    function handlePrevPage() {
        goToPage(currentPage - 1)
    }

    function handleNextPage() {
        goToPage(currentPage + 1)
    }

    function handlePageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setPageInput(e.target.value)
    }

    function handlePageInputSubmit(e: React.FormEvent | React.KeyboardEvent) {
        e.preventDefault()
        const pageNum = parseInt(pageInput, 10)
        if (!isNaN(pageNum)) {
            goToPage(pageNum)
        } else {
            // Reset to current page if invalid input
            setPageInput(String(currentPage))
        }
    }

    function handleZoomIn() {
        setScale(prev => Math.min(prev + 0.2, 2.0))
    }

    function handleZoomOut() {
        setScale(prev => Math.max(prev - 0.2, 0.5))
    }

    return (
        <Card className={`flex flex-col ${className}`}>
            {/* Header */}
            <div className="border-b p-3 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">PDF Viewer</h3>
                    {numPages > 0 && (
                        <span className="text-xs text-muted-foreground">
                            Page {currentPage} of {numPages}
                        </span>
                    )}
                </div>

                {/* Zoom controls */}
                {numPages > 0 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleZoomOut}
                            disabled={scale <= 0.5}
                            className="h-7 w-7 p-0"
                            title="Zoom out"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground px-2">{Math.round(scale * 100)}%</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleZoomIn}
                            disabled={scale >= 2.0}
                            className="h-7 w-7 p-0"
                            title="Zoom in"
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                {error ? (
                    <div className="flex flex-col items-center gap-3 text-center max-w-md">
                        <FileX className="h-12 w-12 text-red-500" />
                        <div>
                            <p className="font-semibold text-sm mb-1">PDF Load Error</p>
                            <p className="text-xs text-muted-foreground mb-2">{error}</p>
                            <p className="text-xs text-muted-foreground">
                                Check browser console (F12) for details
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 shadow-lg">
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex flex-col items-center gap-3 p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading PDF...</p>
                                    <p className="text-xs text-muted-foreground">URL: {pdfUrl.substring(0, 50)}...</p>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={currentPage}
                                scale={scale}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                loading={
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                }
                                onLoadError={(error) => {
                                    console.error('❌ Page render error:', error)
                                }}
                            />
                        </Document>
                    </div>
                )}
            </div>

            {/* Navigation Controls */}
            {numPages > 0 && (
                <div className="border-t p-3 flex items-center justify-between bg-muted/30">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={currentPage <= 1}
                        className="h-8"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Prev
                    </Button>

                    <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Page</span>
                        <input
                            type="number"
                            min={1}
                            max={numPages}
                            value={pageInput}
                            onChange={handlePageInputChange}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handlePageInputSubmit(e)
                                }
                            }}
                            onBlur={handlePageInputSubmit}
                            className="w-14 h-8 text-center text-sm border border-input rounded px-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">of {numPages}</span>
                    </form>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage >= numPages}
                        className="h-8"
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </Card>
    )
}
