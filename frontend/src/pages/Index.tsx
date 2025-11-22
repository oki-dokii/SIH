import { Header } from '@/components/Header'
import { UploadZone } from '@/components/UploadZone'
import { FeatureCard } from '@/components/FeatureCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sparkles, Zap, Lock, BarChart3, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function IndexPage() {
  const navigate = useNavigate()

  const handleUpload = async (file: File) => {
    console.log('Uploading file:', file.name)
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
                Powered by Google Gemini AI
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Analyze Your{' '}
                <span className="text-primary">DPR Documents</span> with AI
              </h1>
              
              <p className="text-xl text-muted-foreground">
                Upload and get instant analysis of your Detailed Project Reports.
                Make better decisions faster.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate('/documents')}>
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </div>
            </div>

            <div>
              <UploadZone onUpload={handleUpload} />
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-primary/20 hover:border-primary/40">
              <div className="text-3xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">Analyzed</div>
            </Card>
            <Card className="p-6 border-accent/20 hover:border-accent/40">
              <div className="text-3xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
            </Card>
            <Card className="p-6 border-primary/20 hover:border-primary/40">
              <div className="text-3xl font-bold text-primary mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Support</div>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Key Features</h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to analyze DPR documents
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Analysis"
              description="Advanced Gemini AI extracts and analyzes detailed project data from your DPR documents automatically."
            />
            <FeatureCard
              icon={Zap}
              title="Instant Processing"
              description="Upload PDFs and get comprehensive analysis in seconds with our optimized extraction pipeline."
            />
            <FeatureCard
              icon={Lock}
              title="Secure & Private"
              description="Your documents are encrypted and processed securely. We never share your data with third parties."
            />
            <FeatureCard
              icon={BarChart3}
              title="Visual Insights"
              description="Interactive dashboards and 3D visualizations help you understand project metrics at a glance."
            />
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 mb-16">
          <div className="bg-gradient-to-r from-primary to-accent rounded-lg p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl mb-8 opacity-90">
              Analyze your DPR documents with AI. Get insights in minutes.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/documents')}
            >
              Start Analyzing <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025{' '}
              <span className="text-primary font-semibold">DPR Analyzer</span> - AI for
              North Eastern Development
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Privacy
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Terms
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
