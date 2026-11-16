import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, UserRole } from '@/types/ats'

interface AuthContextType {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: User }>
  signUp: (
    email: string,
    password: string,
    name: string,
    role?: UserRole,
    company_name?: string,
  ) => Promise<{ error: Error | null }>
  signOut: () => void
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: Error | null }>
  requestVerification: (email: string) => Promise<{ error: Error | null }>
  confirmVerification: (token: string) => Promise<{ error: Error | null }>
  isAdmin: boolean
  isRecruiter: boolean
  isManager: boolean
  isSuperadmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Sincroniza estado com authStore do PocketBase
    setUser((pb.authStore.record as unknown as User) || null)
    setLoading(false)

    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser((model as unknown as User) || null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email.trim(), password)
      const authenticatedUser = authData.record as unknown as User
      setUser(authenticatedUser)
      return { error: null, user: authenticatedUser }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole = 'recruiter',
    company_name = 'Vanguard Soluções PME',
  ) => {
    try {
      const created = await pb.collection('users').create({
        email: email.trim(),
        password,
        passwordConfirm: password,
        name,
        role,
        company_name,
      })

      // Tenta enviar verificação por email de forma best-effort
      try {
        await pb.collection('users').requestVerification(email.trim())
      } catch (_) {
        // best effort
      }

      return { error: null, user: created as unknown as User }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const confirmPasswordReset = async (token: string, password: string) => {
    try {
      await pb.collection('users').confirmPasswordReset(token, password, password)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const requestVerification = async (email: string) => {
    try {
      await pb.collection('users').requestVerification(email.trim())
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const confirmVerification = async (token: string) => {
    try {
      await pb.collection('users').confirmVerification(token)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const role = user?.role || null
  const isAdmin = role === 'admin'
  const isRecruiter = role === 'recruiter' || role === 'admin'
  const isManager = role === 'manager'
  const isSuperadmin = role === 'superadmin'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        confirmPasswordReset,
        requestVerification,
        confirmVerification,
        isAdmin,
        isRecruiter,
        isManager,
        isSuperadmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
