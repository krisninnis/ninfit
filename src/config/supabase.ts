interface SupabaseEnvironment {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export interface SupabaseConfig {
  readonly url: string
  readonly publishableKey: string
}

export function resolveSupabaseEnv(environment: SupabaseEnvironment): SupabaseConfig | null {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) return null

  return Object.freeze({ url, publishableKey })
}

export const supabaseEnv = resolveSupabaseEnv(import.meta.env as SupabaseEnvironment)
export const isSupabaseConfigured = supabaseEnv !== null
