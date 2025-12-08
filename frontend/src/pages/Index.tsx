import { Header } from '@/components/Header'
import { FeatureCard } from '@/components/FeatureCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sparkles, Zap, Lock, BarChart3, ArrowRight, CheckCircle2, FileText, Layers } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useLanguage } from '@/contexts/LanguageContext'

export default function IndexPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24 animate-fade-in">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                <Sparkles className="h-4 w-4" />
                AI-Powered Governance
              </div>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                {t('landing.heroTitle')}{' '}
                <span className="text-primary">{t('landing.heroHighlight')}</span> {t('landing.heroSuffix')}
              </h1>

              <p className="text-xl text-muted-foreground">
                {t('landing.description')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate('/admin/projects')}>
                  {t('landing.getStarted')} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline">
                  {t('landing.learnMore')}
                </Button>
              </div>
            </div>

            <div>
              <Card className="p-8 border-primary/20 bg-gradient-to-br from-background to-muted/20">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold">DPR Analysis Dashboard</h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Welcome to the admin dashboard. Clients upload their Detailed Project Reports (DPRs)
                    which are then available for your review and analysis. Navigate to the{' '}
                    <Link to="/admin/projects" className="text-primary hover:underline font-medium">
                      Projects
                    </Link>{' '}
                    section to view and analyze submitted DPRs.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Review DPRs
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Access client-submitted DPRs organized by project
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        AI Analysis
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Trigger AI-powered analysis on submitted documents
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-background border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-600" />
                        Compare Projects
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Compare multiple DPRs side-by-side for better insights
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
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
              onClick={() => navigate('/admin/projects')}
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
