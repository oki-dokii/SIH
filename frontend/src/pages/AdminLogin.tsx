import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '@/contexts/RoleContext'
import { Card } from '@/components/ui/Card'
import { Shield, Lock, User, AlertCircle } from 'lucide-react'
import { LanguageDropdown } from '@/components/LanguageDropdown'

export default function AdminLogin() {
    const [adminId, setAdminId] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useRole()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!adminId || !password) {
            setError('Please enter both Admin ID and Password')
            return
        }

        // Alphanumeric check for admin ID
        const alphanumericRegex = /^[a-zA-Z0-9]+$/
        if (!alphanumericRegex.test(adminId)) {
            setError('Admin ID must be alphanumeric (letters and numbers only)')
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch('http://127.0.0.1:8000/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    admin_id: adminId,
                    password: password,
                }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                // Login successful
                login()
                navigate('/admin')
            } else {
                setError(data.message || 'Invalid credentials')
            }
        } catch (err) {
            console.error('Login error:', err)
            setError('Failed to connect to server. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-600">
                            <Shield className="h-6 w-6 text-white" />
                        </div>
                        <LanguageDropdown />
                        <span className="text-xl font-bold text-primary">DPR Analyzer</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-16 md:py-24 flex items-center justify-center">
                <div className="w-full max-w-md">
                    <Card className="p-8 shadow-2xl border-primary/10">
                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center shadow-lg">
                                <Shield className="h-10 w-10 text-white" />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2">Admin Login</h1>
                            <p className="text-muted-foreground">
                                Enter your credentials to access the admin dashboard
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Admin ID Field */}
                            <div className="space-y-2">
                                <label htmlFor="adminId" className="block text-sm font-medium text-foreground">
                                    Admin ID
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        type="text"
                                        id="adminId"
                                        value={adminId}
                                        onChange={(e) => setAdminId(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-background"
                                        placeholder="Enter your admin ID"
                                        disabled={isLoading}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Alphanumeric characters only</p>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        type="password"
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-background"
                                        placeholder="Enter your password"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-primary to-cyan-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Logging in...
                                    </span>
                                ) : (
                                    'Login to Dashboard'
                                )}
                            </button>
                        </form>

                        {/* Back Link */}
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => navigate('/role-selection')}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                ← Back to Role Selection
                            </button>
                        </div>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t bg-white/80 backdrop-blur py-6">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        © 2025 <span className="text-primary font-semibold">DPR Analyzer</span> - Ministry of Development of North Eastern Region
                    </p>
                </div>
            </footer>
        </div>
    )
}