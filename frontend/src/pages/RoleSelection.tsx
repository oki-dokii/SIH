import { useRole } from '@/contexts/RoleContext'
import { Card } from '@/components/ui/Card'
import { FileText, Shield, User, Sparkles } from 'lucide-react'

export default function RoleSelectionPage() {
    const { setRole } = useRole()

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                            <FileText className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-primary">DPR Analyzer</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-16 md:py-24">
                <div className="max-w-3xl mx-auto text-center space-y-8">
                    {/* Hero Section */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                            <Sparkles className="h-4 w-4" />
                            AI-Powered Document Analysis
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                            Welcome to <span className="text-primary">DPR Analyzer</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-xl mx-auto">
                            Select your role to access the platform and start analyzing Detailed Project Reports
                        </p>
                    </div>

                    {/* Role Cards */}
                    <div className="grid md:grid-cols-2 gap-6 pt-8">
                        {/* Admin Card */}
                        <Card
                            className="p-8 cursor-pointer group hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                            onClick={() => setRole('admin')}
                        >
                            <div className="space-y-4">
                                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Shield className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold">Admin</h3>
                                <p className="text-muted-foreground">
                                    Full access to upload, analyze, and manage DPR documents with AI-powered insights
                                </p>
                                <div className="pt-4">
                                    <span className="inline-flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                                        Access Dashboard →
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* User Card */}
                        <Card
                            className="p-8 cursor-pointer group hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                            onClick={() => setRole('user')}
                        >
                            <div className="space-y-4">
                                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <User className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold">User</h3>
                                <p className="text-muted-foreground">
                                    View mode for browsing analyzed reports and project documentation
                                </p>
                                <div className="pt-4">
                                    <span className="inline-flex items-center gap-2 text-muted-foreground font-medium group-hover:gap-3 group-hover:text-foreground transition-all">
                                        Coming Soon →
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Features Preview */}
                    <div className="pt-12 grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-primary">10K+</div>
                            <div className="text-sm text-muted-foreground">Documents Analyzed</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-primary">99.9%</div>
                            <div className="text-sm text-muted-foreground">Accuracy Rate</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-primary">24/7</div>
                            <div className="text-sm text-muted-foreground">Availability</div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        © 2025 <span className="text-primary font-semibold">DPR Analyzer</span> - Ministry of Development of North Eastern Region
                    </p>
                </div>
            </footer>
        </div>
    )
}
