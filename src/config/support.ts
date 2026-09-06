interface SupportEnvironment {
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_SUPPORT_RESPONSE_COMMITMENT?: string
}

export interface SupportConfig {
  readonly email: string
  readonly responseCommitment: string
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function resolveSupportEnv(environment: SupportEnvironment): SupportConfig | null {
  const email = environment.VITE_SUPPORT_EMAIL?.trim()
  const responseCommitment = environment.VITE_SUPPORT_RESPONSE_COMMITMENT?.trim()

  if (!email || !responseCommitment || !isPlausibleEmail(email)) return null

  return Object.freeze({ email, responseCommitment })
}

/**
 * Public support configuration only. Nothing here is a secret, but both values must
 * be deliberately supplied before NinFit claims that a monitored support channel is
 * available.
 */
export const supportEnv = resolveSupportEnv(import.meta.env as SupportEnvironment)
export const isSupportConfigured = supportEnv !== null
