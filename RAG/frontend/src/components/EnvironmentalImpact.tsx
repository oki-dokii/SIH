import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Card } from './ui/Card'
import { useLanguage } from '../contexts/LanguageContext'

interface EnvironmentalImpactProps {
  data: {
    overallRiskLevel?: string
    sensitiveAreaFlags?: {
      isInProtectedForest?: boolean
      isNearWaterBody?: boolean
      isInTribalLand?: boolean
      isInWildlifeCorridor?: boolean
      isInEcologicallySensitiveZone?: boolean
    }
    clearancesRequired?: string[]
    environmentalConcerns?: string[]
    mitigationMeasures?: string[]
    impactOnBiodiversity?: string
    waterResourceImpact?: string
    soilAndLandImpact?: string
    airQualityImpact?: string
  }
}

export function EnvironmentalImpact({ data }: EnvironmentalImpactProps) {
  const { t } = useLanguage()
  
  if (!data) return null

  const getRiskColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getRiskIcon = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return <XCircle className="w-5 h-5" />
      case 'medium':
        return <AlertTriangle className="w-5 h-5" />
      case 'low':
        return <CheckCircle className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  const flags = data.sensitiveAreaFlags || {}
  const hasSensitiveAreaFlags = Object.values(flags).some(v => v === true)

  return (
    <div className="space-y-6">
      <Card className="p-6 border-l-4 border-amber-500">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">{t('documentDetail.environmentalImpact')}</h3>
          {data.overallRiskLevel && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${getRiskColor(data.overallRiskLevel)}`}>
              {getRiskIcon(data.overallRiskLevel)}
              <span className="font-semibold">{data.overallRiskLevel} Risk</span>
            </div>
          )}
        </div>

        {hasSensitiveAreaFlags && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">{t('documentDetail.sensitiveAreas')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flags.isInProtectedForest && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-900">{t('documentDetail.protectedForest')}</span>
                </div>
              )}
              {flags.isNearWaterBody && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-900">{t('documentDetail.waterBody')}</span>
                </div>
              )}
              {flags.isInTribalLand && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-orange-900">{t('documentDetail.tribalLand')}</span>
                </div>
              )}
              {flags.isInWildlifeCorridor && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <XCircle className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-900">{t('documentDetail.wildlifeCorridor')}</span>
                </div>
              )}
              {flags.isInEcologicallySensitiveZone && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-900">{t('documentDetail.ecologicallySensitive')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {data.clearancesRequired && data.clearancesRequired.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">{t('documentDetail.clearancesRequired')}</h4>
            <ul className="space-y-2">
              {data.clearancesRequired.map((clearance, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{clearance}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.environmentalConcerns && data.environmentalConcerns.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">{t('documentDetail.environmentalConcerns')}</h4>
            <ul className="space-y-2">
              {data.environmentalConcerns.map((concern, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.mitigationMeasures && data.mitigationMeasures.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">{t('documentDetail.mitigationMeasures')}</h4>
            <ul className="space-y-2">
              {data.mitigationMeasures.map((measure, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{measure}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(data.impactOnBiodiversity || data.waterResourceImpact || data.soilAndLandImpact || data.airQualityImpact) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.impactOnBiodiversity && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Biodiversity Impact</h5>
                <p className="text-sm text-gray-700">{data.impactOnBiodiversity}</p>
              </div>
            )}
            {data.waterResourceImpact && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Water Resource Impact</h5>
                <p className="text-sm text-gray-700">{data.waterResourceImpact}</p>
              </div>
            )}
            {data.soilAndLandImpact && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Soil & Land Impact</h5>
                <p className="text-sm text-gray-700">{data.soilAndLandImpact}</p>
              </div>
            )}
            {data.airQualityImpact && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Air Quality Impact</h5>
                <p className="text-sm text-gray-700">{data.airQualityImpact}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
