import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './client'

export type AuthCredentials = {
  email: string
  password: string
}

export type SignUpCredentials = AuthCredentials & {
  displayName?: string
}

export async function signUp({
  email,
  password,
  displayName,
}: SignUpCredentials): Promise<User | null> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName
        ? { display_name: displayName }
        : undefined,
    },
  })

  if (error) {
    throw error
  }

  return data.user
}

export async function signIn({
  email,
  password,
}: AuthCredentials): Promise<Session> {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (error) {
    throw error
  }

  if (!data.session) {
    throw new Error('Sign in completed without a session')
  }

  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export function onAuthStateChange(
  listener: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session)
  })

  return () => subscription.unsubscribe()
}