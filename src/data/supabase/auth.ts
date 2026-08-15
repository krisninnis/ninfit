import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './client'

export type AuthCredentials = {
  email: string
  password: string
}

export type SignUpCredentials = AuthCredentials & {
  displayName?: string
}

export type SignUpResult = {
  user: User | null
  session: Session | null
}

function confirmationRedirectUrl(): string {
  return `${window.location.origin}/#/profile`
}

export async function signUp({
  email,
  password,
  displayName,
}: SignUpCredentials): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName
        ? { display_name: displayName }
        : undefined,
      emailRedirectTo: confirmationRedirectUrl(),
    },
  })

  if (error) {
    throw error
  }

  return {
    user: data.user,
    session: data.session,
  }
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
export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: {
      emailRedirectTo: confirmationRedirectUrl(),
    },
  })

  if (error) {
    throw error
  }
}
