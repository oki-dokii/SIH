import { useState, useEffect } from 'react'
import { X, RotateCcw, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ComplianceWeights {
    northEasternFocus: number
    beneficiaryAlignment: number
    environmentalCompliance: number
    landAcquisition: number
    documentationQuality: number
    financialViability: number
}

interface ComplianceWeightsModalProps {
    projectId: number
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

const CRITERIA_INFO = [
    { key: 'northEasternFocus', label: 'North Eastern Focus', defaultWeight: 25 },
    { key: 'beneficiaryAlignment', label: 'Beneficiary Alignment', defaultWeight: 20 },
    { key: 'environmentalCompliance', label: 'Environmental Compliance', defaultWeight: 20 },
    { key: 'landAcquisition', label: 'Land Acquisition', defaultWeight: 15 },
    { key: 'documentationQuality', label: 'Documentation Quality', defaultWeight: 10 },
    { key: 'financialViability', label: 'Financial Viability', defaultWeight: 10 },
]

export default function ComplianceWeightsModal({ projectId, isOpen, onClose, onSuccess }: ComplianceWeightsModalProps) {
    const [weights, setWeights] = useState<ComplianceWeights>({
        northEasternFocus: 0.25,
        beneficiaryAlignment: 0.20,
        environmentalCompliance: 0.20,
        landAcquisition: 0.15,
        documentationQuality: 0.10,
        financialViability: 0.10,
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [isCustom, setIsCustom] = useState(false)

    // Load current weights
    useEffect(() => {
        if (isOpen && projectId) {
            loadWeights()
        }
    }, [isOpen, projectId])

    const loadWeights = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`http://127.0.0.1:8000/projects/${projectId}/compliance-weights`)

            if (!response.ok) {
                throw new Error('Failed to load compliance weights')
            }

            const data = await response.json()
            setWeights(data.weights)
            setIsCustom(data.isCustom || false)
        } catch (err: any) {
            setError(err.message || 'Failed to load weights')
            console.error('Load weights error:', err)
        } finally {
            setLoading(false)
        }
    }

    const getPercentageValue = (decimalValue: number) => Math.round(decimalValue * 100)
    const setPercentageValue = (key: keyof ComplianceWeights, percentage: number) => {
        setWeights(prev => ({ ...prev, [key]: percentage / 100 }))
    }

    const totalPercentage = Object.values(weights).reduce((sum, val) => sum + (val * 100), 0)
    const isValid = Math.abs(totalPercentage - 100) < 0.1

    const handleReset = () => {
        const defaultWeights: ComplianceWeights = {
            northEasternFocus: 0.25,
            beneficiaryAlignment: 0.20,
            environmentalCompliance: 0.20,
            landAcquisition: 0.15,
            documentationQuality: 0.10,
            financialViability: 0.10,
        }
        setWeights(defaultWeights)
    }

    const handleSave = async (recalculate: boolean) => {
        if (!isValid) {
            setError('Weights must sum to 100%')
            return
        }

        if (recalculate) {
            setRecalculating(true)
        } else {
            setSaving(true)
        }

        setError(null)
        setSuccessMessage(null)

        try {
            const response = await fetch(`http://127.0.0.1:8000/projects/${projectId}/compliance-weights`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weights, recalculate })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Failed to update weights')
            }

            const data = await response.json()

            if (recalculate && data.recalculated) {
                setSuccessMessage(`Weights updated and ${data.dprs_updated} DPR(s) recalculated successfully!`)
            } else {
                setSuccessMessage('Weights updated successfully!')
            }

            setIsCustom(true)

            // Call success callback after a delay
            setTimeout(() => {
                if (onSuccess) onSuccess()
                onClose()
            }, 2000)

        } catch (err: any) {
            setError(err.message || 'Failed to save weights')
            console.error('Save weights error:', err)
        } finally {
            setSaving(false)
            setRecalculating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">Compliance Scoring Weights</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Customize how MDoNER compliance criteria are weighted for this project
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-muted-foreground">Loading weights...</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                        </div>
                    )}

                    {/* Content */}
                    {!loading && (
                        <>
                            {/* Total Percentage Indicator */}
                            <div className="mb-6 p-4 bg-muted rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Total Weight:</span>
                                    <span className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalPercentage.toFixed(1)}%
                                    </span>
                                </div>
                                {!isValid && (
                                    <p className="text-xs text-red-600 mt-2">Weights must sum to exactly 100%</p>
                                )}
                            </div>

                            {/* Weight Sliders */}
                            <div className="space-y-6 mb-6">
                                {CRITERIA_INFO.map(({ key, label, defaultWeight }) => {
                                    const value = getPercentageValue(weights[key as keyof ComplianceWeights])
                                    return (
                                        <div key={key} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium">{label}</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={value}
                                                        onChange={(e) => setPercentageValue(key as keyof ComplianceWeights, parseInt(e.target.value) || 0)}
                                                        className="w-16 px-2 py-1 text-sm border rounded text-center"
                                                    />
                                                    <span className="text-sm text-muted-foreground w-8">%</span>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    value={value}
                                                    onChange={(e) => setPercentageValue(key as keyof ComplianceWeights, parseInt(e.target.value))}
                                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${value}%, hsl(var(--muted)) ${value}%, hsl(var(--muted)) 100%)`
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>0%</span>
                                                <span className="text-xs">Default: {defaultWeight}%</span>
                                                <span>100%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    className="flex-1"
                                    disabled={saving || recalculating}
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Reset to Defaults
                                </Button>
                                <Button
                                    onClick={() => handleSave(false)}
                                    className="flex-1"
                                    disabled={!isValid || saving || recalculating}
                                >
                                    {saving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Save Weights
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={() => handleSave(true)}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    disabled={!isValid || saving || recalculating}
                                >
                                    {recalculating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Recalculating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Save & Recalculate All DPRs
                                        </>
                                    )}
                                </Button>
                            </div>

                            {isCustom && (
                                <p className="text-xs text-muted-foreground mt-4 text-center">
                                    This project is using custom compliance weights
                                </p>
                            )}
                        </>
                    )}
                </div>
            </Card>
        </div>
    )
}
