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

/**
 * Where a confirmation email sends the user back to.
 *
 * IT MUST NOT CONTAIN A FRAGMENT. This is the whole point of the function, and it
 * has been got wrong twice.
 *
 * We are on the implicit flow (auth-js defaults `flowType` to 'implicit' and the
 * client does not override it), so Supabase returns its tokens IN the fragment:
 *
 *     <redirectTo>#access_token=…&refresh_token=…&type=signup
 *
 * If `redirectTo` already ends in a fragment - as `/#/account/confirmed` did - the
 * result has two `#`, and everything after the FIRST one is the fragment. auth-js
 * then hands `/account/confirmed#access_token=…&refresh_token=…&type=signup` to
 * `URLSearchParams`, which reads the first key as the nonsense
 * `"/account/confirmed#access_token"`. There is no `access_token` key, so
 * `_isImplicitGrantCallback` says no, `detectSessionInUrl` never fires, and the user
 * is silently never signed in. The email is confirmed server-side, so nothing looks
 * broken from the server's side either.
 *
 * Returning the bare origin keeps the fragment free for Supabase. The app still
 * lands in the right place: `looksLikeAuthReturn` in ui/tabs.ts recognises the
 * token fragment and routes into the account experience, and `#/account/confirmed`
 * remains a valid route for anything that links to it directly.
 *
 * `origin` is a parameter so this is testable in the node test environment, where
 * there is no `window`. Production always uses the default.
 */
export function confirmationRedirectUrl(
  origin: string = window.location.origin,
): string {
  return `${origin}/`
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
