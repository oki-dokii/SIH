import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { X, MessageSquare } from 'lucide-react'
import { api, type DPR } from '@/lib/api'

interface FeedbackModalProps {
    dpr: DPR
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function FeedbackModal({ dpr, isOpen, onClose, onSuccess }: FeedbackModalProps) {
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Load existing feedback if any
            setFeedback(dpr.admin_feedback || '')
        }
    }, [isOpen, dpr])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!feedback.trim()) {
            alert('Please enter feedback')
            return
        }

        setSubmitting(true)
        try {
            await api.updateDPRFeedback(dpr.id, feedback)
            alert('Feedback updated successfully!')
            onSuccess()
            onClose()
        } catch (err) {
            console.error('Error updating feedback:', err)
            alert('Failed to update feedback')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        Admin Feedback
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-1">DPR:</p>
                    <p className="font-semibold">{dpr.original_filename}</p>
                    {dpr.client_email && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Submitted by: {dpr.client_email}
                        </p>
                    )}
                    {dpr.feedback_timestamp && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Last updated: {new Date(dpr.feedback_timestamp).toLocaleString()}
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="feedback" className="block text-sm font-medium mb-2">
                            Feedback for Client
                        </label>
                        <textarea
                            id="feedback"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full h-48 px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            placeholder="Enter your feedback for the client here..."
                            disabled={submitting}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Feedback'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
