import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BarChart3, ArrowRight, CheckCircle2, FileText, Layers, Sparkles } from 'lucide-react'
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

        <section className="container mx-auto px-4 py-12 mb-16">
          <div className="grid md:grid-cols-3 gap-6">
            <Card
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-primary/30"
              onClick={() => navigate('/admin/projects')}
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Projects</h3>
                  <p className="text-sm text-muted-foreground">
                    View and manage all DPR submissions organized by project
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-accent/30"
              onClick={() => navigate('/admin/comparisons')}
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Layers className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Comparisons</h3>
                  <p className="text-sm text-muted-foreground">
                    Compare multiple DPRs side-by-side for informed decisions
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-blue-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Leverage AI-powered insights for comprehensive DPR evaluation
                  </p>
                </div>
              </div>
            </Card>
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
