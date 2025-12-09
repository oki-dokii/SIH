const API_BASE_URL = '/api'

export interface DPR {
  id: number
  filename: string
  original_filename: string
  filepath: string
  upload_ts: string
  summary_json: any | null
  project_id?: number
  client_id?: number
  client_email?: string
  admin_feedback?: string
  feedback_timestamp?: string
  validation_flags?: {
    hasFlags: boolean
    flags: Array<{
      type: string
      message: string
      severity: string
    }>
  }
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

export interface Comparison {
  id: number
  name: string
  created_ts: string
  dprs?: DPR[]
  dpr_count?: number
}

export interface ComparisonMessage {
  id: number
  comparison_id: number
  role: string
  text: string
  timestamp: string
}

export interface Project {
  id: number
  name: string
  state: string
  scheme: string
  sector: string
  created_at: string
  dpr_count?: number
}

export const api = {
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`)
    if (!response.ok) throw new Error('Failed to fetch projects')
    const data = await response.json()
    return data.projects || []
  },

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'dpr_count'>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    })
    if (!response.ok) throw new Error('Failed to create project')
    return response.json()
  },

  async deleteProject(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete project')
  },

  async getProject(id: number): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`)
    if (!response.ok) throw new Error('Failed to fetch project')
    return response.json()
  },

  async getProjectDPRs(projectId: number): Promise<DPR[]> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/dprs`)
    if (!response.ok) throw new Error('Failed to fetch project DPRs')
    const data = await response.json()
    return data.dprs || []
  },

  async compareAllProjectDPRs(projectId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/compare-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Comparison failed' }))
      throw new Error(error.detail || 'Failed to compare DPRs')
    }
    return response.json()
  },

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

  async uploadDPR(file: File, projectId?: number, onProgress?: (progress: number) => void): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (projectId) {
      formData.append('project_id', projectId.toString())
    }

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

  async clearChatHistory(dprId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/dpr/${dprId}/chat`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to clear chat history')
  },

  async deleteDPR(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/dpr/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete DPR')
  },

  async updateDPRFeedback(dprId: number, feedback: string): Promise<void> {
    const formData = new FormData()
    formData.append('feedback', feedback)

    const response = await fetch(`${API_BASE_URL}/dprs/${dprId}/feedback`, {
      method: 'PUT',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to update feedback')
  },

  async updateDPRStatus(dprId: number, status: string): Promise<void> {
    const formData = new FormData()
    formData.append('status', status)

    const response = await fetch(`${API_BASE_URL}/dprs/${dprId}/status`, {
      method: 'PUT',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to update status')
  },


  async getComparisons(): Promise<Comparison[]> {
    const response = await fetch(`${API_BASE_URL}/comparison-chats`)
    if (!response.ok) throw new Error('Failed to fetch comparisons')
    const data = await response.json()
    return data.comparisons || []
  },

  async createComparison(name: string, dprIds: number[]): Promise<{ comparison_id: number; name: string }> {
    const response = await fetch(`${API_BASE_URL}/comparison-chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, dpr_ids: dprIds }),
    })
    if (!response.ok) throw new Error('Failed to create comparison')
    return response.json()
  },

  async getComparison(id: number): Promise<Comparison> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${id}`)
    if (!response.ok) throw new Error('Failed to fetch comparison')
    return response.json()
  },

  async deleteComparison(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete comparison')
  },

  async sendComparisonMessage(comparisonId: number, message: string): Promise<ComparisonMessage> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${comparisonId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
    if (!response.ok) throw new Error('Failed to send message')
    const data = await response.json()
    return {
      id: data.message_id || 0,
      comparison_id: comparisonId,
      role: 'assistant',
      text: data.reply,
      timestamp: new Date().toISOString(),
    }
  },

  async getComparisonChatHistory(comparisonId: number): Promise<ComparisonMessage[]> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${comparisonId}/chat/history`)
    if (!response.ok) throw new Error('Failed to fetch comparison chat history')
    const data = await response.json()
    return data.messages || []
  },

  async clearComparisonChatHistory(comparisonId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${comparisonId}/chat`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to clear comparison chat history')
  },

  async addDPRToComparison(comparisonId: number, dprId: number): Promise<Comparison> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${comparisonId}/add-dpr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dpr_id: dprId }),
    })
    if (!response.ok) throw new Error('Failed to add DPR to comparison')
    return response.json()
  },

  async removeDPRFromComparison(comparisonId: number, dprId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/comparison-chat/${comparisonId}/remove-dpr/${dprId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to remove DPR from comparison')
  },
}
