import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Role = 'admin' | null

interface RoleContextType {
    role: Role
    isAdmin: boolean
    isAuthenticated: boolean
    isLoading: boolean
    login: () => void
    logout: () => void
}

const RoleContext = createContext<RoleContextType | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>(null)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    // Load authentication state from localStorage on mount
    useEffect(() => {
        const savedAuth = localStorage.getItem('adminAuthenticated')
        const savedRole = localStorage.getItem('userRole') as Role

        if (savedAuth === 'true' && savedRole === 'admin') {
            setIsAuthenticated(true)
            setRole('admin')
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

    return (
        <RoleContext.Provider value={{
            role,
            isAdmin: role === 'admin',
            isAuthenticated,
            isLoading,
            login,
            logout
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
