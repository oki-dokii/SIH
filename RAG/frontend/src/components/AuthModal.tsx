import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '@/contexts/RoleContext'
import { Card } from '@/components/ui/Card'
import { Shield, Lock, User, AlertCircle, X, Eye, EyeOff } from 'lucide-react'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const { login } = useRole()
    const navigate = useNavigate()

    // Admin Login State
    const [adminId, setAdminId] = useState('')
    const [adminPassword, setAdminPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    if (!isOpen) return null

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!adminId || !adminPassword) {
            setError('Please enter both Admin ID and Password')
            return
        }

        const alphanumericRegex = /^[a-zA-Z0-9]+$/
        if (!alphanumericRegex.test(adminId)) {
            setError('Admin ID must be alphanumeric (letters and numbers only)')
            return
        }

        setIsLoading(true)

        // Validate against environment variables (offline mode)
        // In production, you might want to use import.meta.env.VITE_ADMIN_ID and VITE_ADMIN_PASSWORD
        const validAdminId = 'admin123'
        const validPassword = '123'

        // Simulate authentication delay
        setTimeout(() => {
            if (adminId === validAdminId && adminPassword === validPassword) {
                login()
                onClose()
                navigate('/home')
            } else {
                setError('Invalid credentials. Please try again.')
            }
            setIsLoading(false)
        }, 500)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto relative animate-in zoom-in duration-200">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8 pt-16">
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center mx-auto mb-4">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Admin Login</h2>
                            <p className="text-muted-foreground">
                                Enter your credentials to access the admin dashboard
                            </p>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="adminId" className="block text-sm font-medium">
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

                            <div className="space-y-2">
                                <label htmlFor="adminPassword" className="block text-sm font-medium">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="adminPassword"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-background"
                                        placeholder="Enter your password"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </button>
                                </div>
                            </div>

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
                    </div>
                </div>
            </Card>
        </div>
    )
}
