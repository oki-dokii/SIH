import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Role = 'admin' | 'user' | null

interface UserInfo {
    id: number
    name: string
    email: string
}

interface RoleContextType {
    role: Role
    setRole: (role: Role) => void
    isAdmin: boolean
    isAuthenticated: boolean
    isLoading: boolean
    login: () => void
    logout: () => void
    userInfo: UserInfo | null
    loginUser: (user: UserInfo) => void
    logoutUser: () => void
}

const RoleContext = createContext<RoleContextType | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>(null)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    // Load authentication state from localStorage on mount
    useEffect(() => {
        const savedAuth = localStorage.getItem('adminAuthenticated')
        const savedRole = localStorage.getItem('userRole') as Role
        const savedUserInfo = localStorage.getItem('userInfo')

        if (savedAuth === 'true' && savedRole === 'admin') {
            setIsAuthenticated(true)
            setRole('admin')
        } else if (savedUserInfo && savedRole === 'user') {
            try {
                const user = JSON.parse(savedUserInfo)
                setUserInfo(user)
                setRole('user')
            } catch (e) {
                console.error('Failed to parse user info:', e)
            }
        }

        // Set loading to false after attempting to restore auth state
        setIsLoading(false)
    }, [])

    const login = () => {
        setIsAuthenticated(true)
        setRole('admin')
        localStorage.setItem('adminAuthenticated', 'true')
        localStorage.setItem('userRole', 'admin')
    }

    const logout = () => {
        setIsAuthenticated(false)
        setRole(null)
        localStorage.removeItem('adminAuthenticated')
        localStorage.removeItem('userRole')
    }

    const loginUser = (user: UserInfo) => {
        setUserInfo(user)
        setRole('user')
        localStorage.setItem('userInfo', JSON.stringify(user))
        localStorage.setItem('userRole', 'user')
    }

    const logoutUser = () => {
        setUserInfo(null)
        setRole(null)
        localStorage.removeItem('userInfo')
        localStorage.removeItem('userRole')
    }

    return (
        <RoleContext.Provider value={{
            role,
            setRole,
            isAdmin: role === 'admin',
            isAuthenticated,
            isLoading,
            login,
            logout,
            userInfo,
            loginUser,
            logoutUser
        }}>
            {children}
        </RoleContext.Provider>
    )
}

export function useRole() {
    const context = useContext(RoleContext)
    if (!context) {
        throw new Error('useRole must be used within a RoleProvider')
    }
    return context
}
