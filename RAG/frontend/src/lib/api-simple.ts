const API_BASE_URL = '/api'

export interface PDF {
    id: number
    filename: string
    original_filename: string
    filepath: string
    num_chunks: number | null
    upload_ts: string
}

export interface Message {
    id: number
    pdf_id: number
    role: string
    text: string
    timestamp: string
}

export interface UploadResponse {
    id: number
    filename: string
    num_chunks: number
    existing: boolean
}

export interface ChatResponse {
    reply: string
    sources: string[]
}

export const api = {
    // Upload PDF
    async uploadPDF(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const xhr = new XMLHttpRequest()

        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = (e.loaded / e.total) * 100
                    onProgress(progress)
                }
            })

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText))
                } else {
                    reject(new Error('Upload failed'))
                }
            })

            xhr.addEventListener('error', () => reject(new Error('Upload failed')))
            xhr.open('POST', `${API_BASE_URL}/upload-pdf`)
            xhr.send(formData)
        })
    },

    // Get all PDFs
    async getPDFs(): Promise<PDF[]> {
        const response = await fetch(`${API_BASE_URL}/pdfs`)
        if (!response.ok) throw new Error('Failed to fetch PDFs')
        const data = await response.json()
        return data.pdfs || []
    },

    // Get specific PDF
    async getPDF(id: number): Promise<PDF> {
        const response = await fetch(`${API_BASE_URL}/pdf/${id}`)
        if (!response.ok) throw new Error('Failed to fetch PDF')
        return response.json()
    },

    // Chat with PDF
    async sendChatMessage(pdfId: number, message: string): Promise<ChatResponse> {
        const response = await fetch(`${API_BASE_URL}/pdf/${pdfId}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        })
        if (!response.ok) throw new Error('Failed to send message')
        return response.json()
    },

    // Get chat history
    async getChatHistory(pdfId: number): Promise<Message[]> {
        const response = await fetch(`${API_BASE_URL}/pdf/${pdfId}/messages`)
        if (!response.ok) throw new Error('Failed to fetch chat history')
        const data = await response.json()
        return data.messages || []
    },

    // Clear chat history
    async clearChatHistory(pdfId: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/pdf/${pdfId}/messages`, {
            method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to clear chat history')
    },

    // Delete PDF
    async deletePDF(id: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/pdf/${id}`, {
            method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete PDF')
    },
}
