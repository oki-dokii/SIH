const API_BASE_URL = '/api'

export interface DPR {
  id: number
  filename: string
  original_filename: string
  filepath: string
  upload_ts: string
  summary_json: any | null
}

export interface Message {
  id: number
  dpr_id: number
  role: string
  text: string
  timestamp: string
}

export interface UploadResponse {
  id: number
  filename: string
  message: string
}

export const api = {
  async getDPRs(): Promise<DPR[]> {
    const response = await fetch(`${API_BASE_URL}/dprs`)
    if (!response.ok) throw new Error('Failed to fetch DPRs')
    const data = await response.json()
    return data.dprs || []
  },

  async getDPR(id: number): Promise<DPR> {
    const response = await fetch(`${API_BASE_URL}/dpr/${id}`)
    if (!response.ok) throw new Error('Failed to fetch DPR')
    return response.json()
  },

  async uploadDPR(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> {
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
      xhr.open('POST', `${API_BASE_URL}/upload-dpr`)
      xhr.send(formData)
    })
  },

  async sendChatMessage(dprId: number, message: string): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/dpr/${dprId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
    if (!response.ok) throw new Error('Failed to send message')
    const data = await response.json()
    return {
      id: data.message_id,
      dpr_id: dprId,
      role: 'assistant',
      text: data.reply,
      timestamp: new Date().toISOString(),
    }
  },

  async getChatHistory(dprId: number): Promise<Message[]> {
    const response = await fetch(`${API_BASE_URL}/dpr/${dprId}/chat/history`)
    if (!response.ok) throw new Error('Failed to fetch chat history')
    const data = await response.json()
    return data.messages || []
  },

  async deleteDPR(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/dpr/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete DPR')
  },
}
