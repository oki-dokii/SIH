import { Header } from '@/components/Header'
import { UploadZone } from '@/components/UploadZone'
import { FeatureCard } from '@/components/FeatureCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sparkles, Zap, Lock, BarChart3, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function IndexPage() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const result = await api.uploadDPR(file, language, (progress) => {
        setUploadProgress(progress)
      })
      
      navigate(`/document/${result.id}`)
    } catch (err) {
      setError('Failed to upload file. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
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
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t('common.loading')}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t('landing.uploadPrompt')}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{Math.round(uploadProgress)}%</p>
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
    </div>
  )
}
