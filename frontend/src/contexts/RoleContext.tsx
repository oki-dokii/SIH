import { createContext, useContext, useState, type ReactNode } from 'react'

type Role = 'admin' | 'user' | null

interface RoleContextType {
    role: Role
    setRole: (role: Role) => void
    isAdmin: boolean
}

const RoleContext = createContext<RoleContextType | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>(null)

    return (
        <RoleContext.Provider value={{ role, setRole, isAdmin: role === 'admin' }}>
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
