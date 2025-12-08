import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '@/contexts/RoleContext'
import { Card } from '@/components/ui/Card'
import { Shield, User as UserIcon, Lock, Mail, AlertCircle, X, ArrowLeft, Eye, EyeOff } from 'lucide-react'

type AuthStep = 'role-selection' | 'admin-login' | 'user-auth'
type UserAuthTab = 'login' | 'signup'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [currentStep, setCurrentStep] = useState<AuthStep>('role-selection')
    const [userAuthTab, setUserAuthTab] = useState<UserAuthTab>('login')
    const { login, loginUser } = useRole()
    const navigate = useNavigate()

    // Admin Login State
    const [adminId, setAdminId] = useState('')
    const [adminPassword, setAdminPassword] = useState('')
    const [adminError, setAdminError] = useState('')
    const [adminLoading, setAdminLoading] = useState(false)
    const [showAdminPassword, setShowAdminPassword] = useState(false)

    // User Auth State
    const [userEmail, setUserEmail] = useState('')
    const [userPassword, setUserPassword] = useState('')
    const [userConfirmPassword, setUserConfirmPassword] = useState('')
    const [userName, setUserName] = useState('')
    const [userError, setUserError] = useState('')
    const [userLoading, setUserLoading] = useState(false)
    const [showUserPassword, setShowUserPassword] = useState(false)

    if (!isOpen) return null

    const handleRoleSelect = (role: 'admin' | 'user') => {
        if (role === 'admin') {
            setCurrentStep('admin-login')
        } else {
            setCurrentStep('user-auth')
        }
    }

    const handleBack = () => {
        setCurrentStep('role-selection')
        // Reset forms
        setAdminId('')
        setAdminPassword('')
        setAdminError('')
        setUserEmail('')
        setUserPassword('')
        setUserName('')
        setUserError('')
    }

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setAdminError('')

        if (!adminId || !adminPassword) {
            setAdminError('Please enter both Admin ID and Password')
            return
        }

        const alphanumericRegex = /^[a-zA-Z0-9]+$/
        if (!alphanumericRegex.test(adminId)) {
            setAdminError('Admin ID must be alphanumeric (letters and numbers only)')
            return
        }

        setAdminLoading(true)

        try {
            const response = await fetch('http://127.0.0.1:8000/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: adminId, password: adminPassword }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                login()
                onClose()
                navigate('/admin')
            } else {
                setAdminError(data.message || 'Invalid credentials')
            }
        } catch (err) {
            console.error('Login error:', err)
            setAdminError('Failed to connect to server. Please try again.')
        } finally {
            setAdminLoading(false)
        }
    }

    const handleUserAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setUserError('')

        if (userAuthTab === 'login') {
            // User Login
            if (!userEmail || !userPassword) {
                setUserError('Please enter your email and password')
                return
            }

            setUserLoading(true)

            try {
                const response = await fetch('http://127.0.0.1:8000/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail, password: userPassword }),
                })

                const data = await response.json()

                if (response.ok && data.success) {
                    loginUser({
                        id: data.user.id,
                        name: data.user.name,
                        email: data.user.email
                    })
                    onClose()
                    navigate('/user/dashboard')
                } else {
                    setUserError(data.detail || data.message || 'Invalid credentials')
                }
            } catch (err: any) {
                console.error('Login error:', err)
                setUserError(err.message || 'Failed to connect to server. Please try again.')
            } finally {
                setUserLoading(false)
            }
        } else {
            // User Signup - Client-side validation
            if (!userName || !userEmail || !userPassword || !userConfirmPassword) {
                setUserError('Please fill in all fields')
                return
            }

            // Check if passwords match
            if (userPassword !== userConfirmPassword) {
                setUserError('Passwords do not match')
                return
            }

            // Validate email format
            if (!userEmail.includes('@') || !userEmail.includes('.')) {
                setUserError('Please enter a valid email address')
                return
            }

            // Validate password length
            if (userPassword.length < 8) {
                setUserError('Password must be at least 8 characters long')
                return
            }

            setUserLoading(true)

            try {
                const response = await fetch('http://127.0.0.1:8000/api/user/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: userName,
                        email: userEmail,
                        password: userPassword,
                        confirm_password: userConfirmPassword
                    }),
                })

                const data = await response.json()

                if (response.ok && data.success) {
                    loginUser({
                        id: data.user.id,
                        name: data.user.name,
                        email: data.user.email
                    })
                    onClose()
                    navigate('/user/dashboard')
                } else {
                    // Show detailed error from backend
                    const errorMessage = data.detail || data.message || 'Signup failed. Please try again.'
                    setUserError(errorMessage)
                    console.error('Signup failed:', data)
                }
            } catch (err: any) {
                console.error('Signup error:', err)
                const errorMessage = err.message || 'Failed to connect to server. Please try again.'
                setUserError(errorMessage)
            } finally {
                setUserLoading(false)
            }
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in duration-200">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Back Button (shown on login steps) */}
                {currentStep !== 'role-selection' && (
                    <button
                        onClick={handleBack}
                        className="absolute top-4 left-4 p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm text-muted-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                )}

                <div className="p-8 pt-16">
                    {/* Step 1: Role Selection */}
                    {currentStep === 'role-selection' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
                                    <Shield className="h-4 w-4" />
                                    AI-Powered Document Analysis
                                </div>
                                <h2 className="text-3xl font-bold mb-2">Welcome to DPR Analyzer</h2>
                                <p className="text-muted-foreground">
                                    Select your role to access the platform and start analyzing Detailed Project Reports
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                {/* Admin Card */}
                                <button
                                    onClick={() => handleRoleSelect('admin')}
                                    className="group p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left"
                                >
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Shield className="h-8 w-8 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold mb-2">Admin</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Full access to upload, analyze, and manage DPR documents with AI-powered insights
                                            </p>
                                        </div>
                                        <div className="text-sm text-primary font-medium group-hover:underline">
                                            Access Dashboard →
                                        </div>
                                    </div>
                                </button>

                                {/* User Card */}
                                <button
                                    onClick={() => handleRoleSelect('user')}
                                    className="group p-6 rounded-2xl border-2 border-border hover:border-purple-600 hover:bg-purple-600/5 transition-all duration-200 text-left"
                                >
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <UserIcon className="h-8 w-8 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold mb-2">Client</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Upload and manage your DPRs, track project progress, and access analyzed reports
                                            </p>
                                        </div>
                                        <div className="text-sm text-purple-600 font-medium group-hover:underline">
                                            Access Dashboard →
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2a: Admin Login */}
                    {currentStep === 'admin-login' && (
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

                            {adminError && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{adminError}</p>
                                </div>
                            )}

                            <form onSubmit={handleAdminLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="adminId" className="block text-sm font-medium">
                                        Admin ID
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            id="adminId"
                                            value={adminId}
                                            onChange={(e) => setAdminId(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-background"
                                            placeholder="Enter your admin ID"
                                            disabled={adminLoading}
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
                                            type={showAdminPassword ? 'text' : 'password'}
                                            id="adminPassword"
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            className="block w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-background"
                                            placeholder="Enter your password"
                                            disabled={adminLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        >
                                            {showAdminPassword ? (
                                                <EyeOff className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={adminLoading}
                                    className="w-full bg-gradient-to-r from-primary to-cyan-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {adminLoading ? (
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
                    )}

                    {/* Step 2b: User Auth */}
                    {currentStep === 'user-auth' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto mb-4">
                                    <UserIcon className="h-8 w-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">User Access</h2>
                                <p className="text-muted-foreground">
                                    {userAuthTab === 'login' ? 'Login to your account' : 'Create a new account'}
                                </p>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 p-1 bg-muted rounded-lg">
                                <button
                                    onClick={() => setUserAuthTab('login')}
                                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${userAuthTab === 'login'
                                        ? 'bg-background shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setUserAuthTab('signup')}
                                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${userAuthTab === 'signup'
                                        ? 'bg-background shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Sign Up
                                </button>
                            </div>

                            {userError && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{userError}</p>
                                </div>
                            )}

                            <form onSubmit={handleUserAuth} className="space-y-4">
                                {userAuthTab === 'signup' && (
                                    <>
                                        <div className="space-y-2">
                                            <label htmlFor="userName" className="block text-sm font-medium">
                                                Full Name
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <input
                                                    type="text"
                                                    id="userName"
                                                    value={userName}
                                                    onChange={(e) => setUserName(e.target.value)}
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors bg-background"
                                                    placeholder="Enter your full name"
                                                    disabled={userLoading}
                                                />
                                            </div>
                                        </div>

                                    </>
                                )}

                                {userAuthTab === 'login' && (
                                    <div className="space-y-2">
                                        <label htmlFor="userEmailLogin" className="block text-sm font-medium">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="email"
                                                id="userEmailLogin"
                                                value={userEmail}
                                                onChange={(e) => setUserEmail(e.target.value)}
                                                className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors bg-background"
                                                placeholder="Enter your email"
                                                disabled={userLoading}
                                            />
                                        </div>
                                    </div>
                                )}

                                {userAuthTab === 'signup' && (
                                    <div className="space-y-2">
                                        <label htmlFor="userEmail" className="block text-sm font-medium">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="email"
                                                id="userEmail"
                                                value={userEmail}
                                                onChange={(e) => setUserEmail(e.target.value)}
                                                className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors bg-background"
                                                placeholder="Enter your email"
                                                disabled={userLoading}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="userPassword" className="block text-sm font-medium">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <input
                                            type={showUserPassword ? 'text' : 'password'}
                                            id="userPassword"
                                            value={userPassword}
                                            onChange={(e) => setUserPassword(e.target.value)}
                                            className="block w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors bg-background"
                                            placeholder="Enter your password"
                                            disabled={userLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowUserPassword(!showUserPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        >
                                            {showUserPassword ? (
                                                <EyeOff className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {userAuthTab === 'signup' && (
                                    <div className="space-y-2">
                                        <label htmlFor="userConfirmPassword" className="block text-sm font-medium">
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="password"
                                                id="userConfirmPassword"
                                                value={userConfirmPassword}
                                                onChange={(e) => setUserConfirmPassword(e.target.value)}
                                                className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors bg-background"
                                                placeholder="Re-enter your password"
                                                disabled={userLoading}
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={userLoading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {userLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            {userAuthTab === 'login' ? 'Logging in...' : 'Creating account...'}
                                        </span>
                                    ) : (
                                        userAuthTab === 'login' ? 'Login' : 'Create Account'
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}
