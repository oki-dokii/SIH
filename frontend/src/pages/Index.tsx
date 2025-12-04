import { Header } from '@/components/Header'
import { UploadZone } from '@/components/UploadZone'
import { FeatureCard } from '@/components/FeatureCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sparkles, Zap, Lock, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { ProjectSelectionModal } from '@/components/ProjectSelectionModal'

export default function IndexPage() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Project Selection State
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)

  const handleUpload = async (file: File) => {
    setPendingFile(file)
    setIsProjectModalOpen(true)
  }

  const handleProjectSelect = async (projectId: number) => {
    if (!pendingFile) return

    setIsProjectModalOpen(false)
    setUploading(true)
    setProcessing(false)
    setUploadSuccess(false)
    setError(null)
    setUploadProgress(0)

    try {
      const result = await api.uploadDPR(pendingFile, language, projectId, (progress) => {
        setUploadProgress(progress)
        if (progress === 100) {
          setProcessing(true)
        }
      })

      setUploadSuccess(true)
      // Small delay to show success message before redirect
      setTimeout(() => {
        navigate(`/documents/${result.id}`)
      }, 1500)
    } catch (err) {
      setError('Failed to upload file. Please try again.')
      console.error('Upload error:', err)
      setUploading(false)
      setProcessing(false)
    } finally {
      setPendingFile(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24 animate-fade-in">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                <Sparkles className="h-4 w-4" />
                {t('landing.subtitle')}
              </div>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                {t('landing.heroTitle')}{' '}
                <span className="text-primary">{t('landing.heroHighlight')}</span> {t('landing.heroSuffix')}
              </h1>

              <p className="text-xl text-muted-foreground">
                {t('landing.description')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate('/documents')}>
                  {t('landing.getStarted')} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline">
                  {t('landing.learnMore')}
                </Button>
              </div>
            </div>

            <div>
              {uploading ? (
                <Card className="p-8">
                  <div className="text-center">
                    {uploadSuccess ? (
                      <div className="animate-in fade-in zoom-in duration-300">
                        <div className="mb-4 flex justify-center">
                          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-green-600">Upload Complete!</h3>
                        <p className="text-muted-foreground">Redirecting to analysis...</p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          {processing ? 'Processing Document...' : t('common.loading')}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {processing
                            ? 'Analyzing content with AI. This may take a moment.'
                            : t('landing.uploadPrompt')}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {processing ? '100%' : `${Math.round(uploadProgress)}%`}
                        </p>
                      </>
                    )}
                  </div>
                </Card>
              ) : (
                <>
                  <UploadZone onUpload={handleUpload} />
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-primary/20 hover:border-primary/40">
              <div className="text-3xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats1')}</div>
            </Card>
            <Card className="p-6 border-accent/20 hover:border-accent/40">
              <div className="text-3xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats2')}</div>
            </Card>
            <Card className="p-6 border-primary/20 hover:border-primary/40">
              <div className="text-3xl font-bold text-primary mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats3')}</div>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">{t('landing.keyFeatures')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.keyFeaturesDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Sparkles}
              title={t('landing.feature1Title')}
              description={t('landing.feature1Desc')}
            />
            <FeatureCard
              icon={Zap}
              title={t('landing.feature2Title')}
              description={t('landing.feature2Desc')}
            />
            <FeatureCard
              icon={Lock}
              title={t('landing.feature3Title')}
              description={t('landing.feature3Desc')}
            />
            <FeatureCard
              icon={BarChart3}
              title={t('landing.feature4Title')}
              description={t('landing.feature4Desc')}
            />
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 mb-16">
          <div className="bg-gradient-to-r from-primary to-accent rounded-lg p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">{t('landing.ctaTitle')}</h2>
            <p className="text-xl mb-8 opacity-90">
              {t('landing.ctaDesc')}
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/documents')}
            >
              {t('landing.ctaButton')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025{' '}
              <span className="text-primary font-semibold">{t('landing.title')}</span> - {t('landing.footer')}
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                {t('landing.privacy')}
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                {t('landing.terms')}
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                {t('landing.contact')}
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ProjectSelectionModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false)
          setPendingFile(null)
        }}
        onSelect={handleProjectSelect}
      />
    </div>
  )
}
